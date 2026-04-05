require("dotenv").config();
const { s3 } = require("../utils/aws-helper");

const randomString = (numberCharacter) => {
  return `${Math.random()
    .toString(36)
    .substring(2, numberCharacter + 2)}`;
};

const FILE_TYPE_MATCH = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "video/mp3",
  "video/mp4",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.rar",
  "application/zip",
];

const buildPublicFileUrl = ({ key, location }) => {
  const cloudfrontUrl = (process.env.CLOUDFRONT_URL || "").trim();

  if (cloudfrontUrl) {
    const normalizedBase = cloudfrontUrl.replace(/\/+$/, "");
    const normalizedKey = String(key || "").replace(/^\/+/, "");
    return `${normalizedBase}/${normalizedKey}`;
  }

  return location;
};

const getSignedUrl = async (params) => {
  if (typeof s3.getSignedUrlPromise === "function") {
    return s3.getSignedUrlPromise("getObject", params);
  }

  return new Promise((resolve, reject) => {
    s3.getSignedUrl("getObject", params, (error, url) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(url);
    });
  });
};

const extractS3ObjectKey = (fileRef) => {
  const bucketName = (process.env.BUCKET_NAME || "").trim();
  if (!fileRef || !bucketName) {
    return null;
  }

  const rawValue = String(fileRef).trim();
  if (!rawValue) {
    return null;
  }

  if (!/^https?:\/\//i.test(rawValue)) {
    return rawValue.replace(/^\/+/, "");
  }

  try {
    const parsed = new URL(rawValue);
    const host = parsed.hostname;
    const pathname = decodeURIComponent(parsed.pathname || "");

    if (host === `${bucketName}.s3.amazonaws.com`) {
      return pathname.replace(/^\/+/, "");
    }

    if (host.startsWith(`${bucketName}.s3.`) && host.endsWith(".amazonaws.com")) {
      return pathname.replace(/^\/+/, "");
    }

    if (
      (host === "s3.amazonaws.com" || host.startsWith("s3.")) &&
      pathname.startsWith(`/${bucketName}/`)
    ) {
      return pathname.slice(bucketName.length + 2);
    }
  } catch (error) {
    return null;
  }

  return null;
};

const getAccessibleFileUrl = async (fileRef) => {
  const bucketName = (process.env.BUCKET_NAME || "").trim();
  const expiresIn = Number(process.env.S3_SIGNED_URL_EXPIRES_SECONDS || 3600);
  const objectKey = extractS3ObjectKey(fileRef);

  if (!bucketName || !objectKey) {
    return fileRef;
  }

  return getSignedUrl({
    Bucket: bucketName,
    Key: objectKey,
    Expires: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600,
  });
};

const getAccessibleFileUrls = async (fileRefs = []) =>
  Promise.all((Array.isArray(fileRefs) ? fileRefs : []).map((fileRef) => getAccessibleFileUrl(fileRef)));

const deleteFiles = async (fileRefs = []) => {
  const bucketName = (process.env.BUCKET_NAME || "").trim();

  if (!bucketName || !Array.isArray(fileRefs) || fileRefs.length === 0) {
    return { deletedCount: 0 };
  }

  const uniqueKeys = [...new Set(
    fileRefs
      .map((fileRef) => extractS3ObjectKey(fileRef))
      .filter(Boolean)
  )];

  if (!uniqueKeys.length) {
    return { deletedCount: 0 };
  }

  await s3.deleteObjects({
    Bucket: bucketName,
    Delete: {
      Objects: uniqueKeys.map((Key) => ({ Key })),
      Quiet: true,
    },
  }).promise();

  return { deletedCount: uniqueKeys.length };
};

const uploadFile = async (file) => {
  const filePath = `${randomString(4)}-${new Date().getTime()}-${file?.originalname}`;
  const bucketName = (process.env.BUCKET_NAME || "").trim();
  const objectAcl = (process.env.S3_OBJECT_ACL || "").trim();

  if (FILE_TYPE_MATCH.indexOf(file.mimetype) === -1) {
    throw new Error(`${file?.originalname} is invalid!`);
  }

  if (!bucketName) {
    throw new Error("BUCKET_NAME is not configured");
  }

  const uploadParams = {
    Bucket: bucketName,
    Body: file?.buffer,
    Key: filePath,
    ContentType: file?.mimetype,
  };

  if (objectAcl) {
    uploadParams.ACL = objectAcl;
  }

  try {
    const data = await s3.upload(uploadParams).promise();

    console.log(`File uploaded successfully. ${data.Location}`);

    return buildPublicFileUrl({
      key: data.Key,
      location: data.Location,
    });
  } catch (err) {
    console.error("Error uploading file to AWS S3:", err);
    throw new Error(`Upload file to AWS S3 failed: ${err.message}`);
  }
};

module.exports = {
  deleteFiles,
  getAccessibleFileUrl,
  getAccessibleFileUrls,
  uploadFile,
};
