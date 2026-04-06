const multer = require("multer");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const MAX_FILE_COUNT = 10;

const storage = multer.memoryStorage();

const uploadFields = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 50,
    files: MAX_FILE_COUNT,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
}).fields([
  { name: "file", maxCount: 1 },
  { name: "image", maxCount: 1 },
  { name: "files", maxCount: MAX_FILE_COUNT },
]);

const upload = (req, res, next) => {
  uploadFields(req, res, (error) => {
    if (!error) {
      const groupedFiles = req.files || {};
      const uploadedFiles = [
        ...(groupedFiles.files || []),
        ...(groupedFiles.file || []),
        ...(groupedFiles.image || []),
      ];

      req.uploadedFiles = uploadedFiles;
      req.file =
        groupedFiles.file?.[0] ||
        groupedFiles.image?.[0] ||
        groupedFiles.files?.[0] ||
        null;

      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ message: "File qua lon. Toi da 50MB." });
        return;
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        res.status(400).json({
          message: `Chi duoc tai toi da ${MAX_FILE_COUNT} tep trong mot lan.`,
        });
        return;
      }

      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        res.status(400).json({
          message:
            "Dinh dang hoac truong tep khong ho tro. Chi chap nhan anh/video pho bien.",
        });
        return;
      }
    }

    res.status(500).json({ message: "Upload middleware failed" });
  });
};

module.exports = upload;
