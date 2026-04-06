require("dotenv").config();
const path = require("path");
const { s3 } = require("../utils/aws-helper");

const randomString = (numberCharacter) =>
  `${Math.random().toString(36).substring(2, numberCharacter + 2)}`;

const FILE_TYPE_MATCH = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp3",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.rar",
  "application/zip",
]);

const MIME_EXTENSION_MAP = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "video/mp3": ".mp3",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.rar": ".rar",
  "application/zip": ".zip",
};

const sanitizePathSegment = (value, fallback = "file") => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return fallback;
  }

  const sanitized = normalized.replace(/[^a-zA-Z0-9-_]/g, "_");
  return sanitized || fallback;
};

const normalizePathParts = (...parts) =>
  parts
    .flatMap((part) => String(part || "").split("/"))
    .map((part) => sanitizePathSegment(part, "folder"))
    .filter(Boolean);

const getFileExtension = (file = {}) => {
  const originalExtension = path.extname(file.originalname || "");
  if (originalExtension) {
    return originalExtension.toLowerCase();
  }

  return MIME_EXTENSION_MAP[file.mimetype] || ".bin";
};

const getFileBaseName = (file = {}) => {
  const originalName = path.basename(file.originalname || "file", path.extname(file.originalname || ""));
  return sanitizePathSegment(originalName, "file");
};

const buildObjectKey = (file, { folder = "uploads", subfolder = "" } = {}) => {
  const extension = getFileExtension(file);
  const baseName = getFileBaseName(file);
  const uniqueName = `${randomString(6)}-${Date.now()}-${baseName}${extension}`;
  return [...normalizePathParts(folder), ...normalizePathParts(subfolder), uniqueName].join("/");
};

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

const uploadFile = async (file, options = {}) => {
  const bucketName = (process.env.BUCKET_NAME || "").trim();
  const objectAcl = (process.env.S3_OBJECT_ACL || "").trim();

  if (!file || !FILE_TYPE_MATCH.has(file.mimetype)) {
    throw new Error(`${file?.originalname || "file"} is invalid!`);
  }

  if (!bucketName) {
    throw new Error("BUCKET_NAME is not configured");
  }

  const objectKey = buildObjectKey(file, options);
  const uploadParams = {
    Bucket: bucketName,
    Body: file.buffer,
    Key: objectKey,
    ContentType: file.mimetype,
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
  } catch (error) {
    console.error("Error uploading file to AWS S3:", error);
    throw new Error(`Upload file to AWS S3 failed: ${error.message}`);
  }
};

const uploadFiles = async (files = [], options = {}) =>
  Promise.all((Array.isArray(files) ? files : []).map((file) => uploadFile(file, options)));

module.exports = {
  deleteFiles,
  getAccessibleFileUrl,
  getAccessibleFileUrls,
  uploadFile,
  uploadFiles,
};
