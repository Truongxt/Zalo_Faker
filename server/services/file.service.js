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

const uploadFile = async (file) => {
  const filePath = `${randomString(4)}-${new Date().getTime()}-${file?.originalname}`;

  if (FILE_TYPE_MATCH.indexOf(file.mimetype) === -1) {
    throw new Error(`${file?.originalname} is invalid!`);
  }

  const uploadParams = {
    Bucket: (process.env.BUCKET_NAME || "").trim(),
    Body: file?.buffer,
    Key: filePath,
    ContentType: file?.mimetype,
    ACL: "public-read",
  };

  try {
    const data = await s3.upload(uploadParams).promise();

    console.log(`File uploaded successfully. ${data.Location}`);

    return buildPublicFileUrl({
      key: data.Key,
      location: data.Location,
    });
  } catch (err) {
    console.error("Error uploading file to AWS S3:", err);
    throw new Error("Upload file to AWS S3 failed");
  }
};

module.exports = {
  uploadFile,
};
