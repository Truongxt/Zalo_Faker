require("dotenv").config();
const path = require("path");
const heicConvert = require("heic-convert");
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
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/webm",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
]);

const MIME_EXTENSION_MAP = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/m4a": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/webm": ".webm",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.rar": ".rar",
  "application/x-rar-compressed": ".rar",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
  "text/plain": ".txt",
};

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);

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

const deleteFolder = async (folderPath) => {
  const bucketName = (process.env.BUCKET_NAME || "").trim();
  if (!bucketName || !folderPath) return { deletedCount: 0 };

  const normalizedPrefix = folderPath.replace(/^\/+/, "").replace(/\/+$/, "") + "/";

  const listedObjects = await s3.listObjectsV2({
    Bucket: bucketName,
    Prefix: normalizedPrefix
  }).promise();

  if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
    return { deletedCount: 0 };
  }

  const deleteParams = {
    Bucket: bucketName,
    Delete: { Objects: [] }
  };

  listedObjects.Contents.forEach(({ Key }) => {
    deleteParams.Delete.Objects.push({ Key });
  });

  await s3.deleteObjects(deleteParams).promise();

  if (listedObjects.IsTruncated) {
    const next = await deleteFolder(folderPath);
    return { deletedCount: listedObjects.Contents.length + next.deletedCount };
  }

  return { deletedCount: listedObjects.Contents.length };
};

const replaceExtension = (fileName = "file", nextExtension = ".jpg") => {
  const baseName = path.basename(fileName, path.extname(fileName));
  return `${baseName}${nextExtension}`;
};

const normalizeUploadFile = async (file) => {
  if (!file) {
    return file;
  }

  if (!HEIC_MIME_TYPES.has(file.mimetype)) {
    return file;
  }

  try {
    const converted = await heicConvert({
      buffer: file.buffer,
      format: "JPEG",
      quality: 0.92,
    });

    const convertedBuffer = Buffer.isBuffer(converted)
      ? converted
      : Buffer.from(converted);

    return {
      ...file,
      buffer: convertedBuffer,
      mimetype: "image/jpeg",
      originalname: replaceExtension(file.originalname, ".jpg"),
    };
  } catch (error) {
    console.error("Failed to convert HEIC/HEIF to JPEG:", error);
    throw new Error("Convert HEIC/HEIF to JPEG failed");
  }
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

  const normalizedFile = await normalizeUploadFile(file);
  const objectKey = buildObjectKey(normalizedFile, options);
  const uploadParams = {
    Bucket: bucketName,
    Body: normalizedFile.buffer,
    Key: objectKey,
    ContentType: normalizedFile.mimetype,
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
  deleteFolder,
  extractS3ObjectKey,
  getAccessibleFileUrl,
  getAccessibleFileUrls,
  uploadFile,
  uploadFiles,
};
