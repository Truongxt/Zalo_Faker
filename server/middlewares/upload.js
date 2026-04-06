const multer = require("multer");

<<<<<<< HEAD
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

// Set up Multer storage options
// Sử dụng memoryStorage sẽ giúp chúng ta thao tác với các tập tin trước khi lưu 
// vào bộ nhớ hoặc database
const storage = multer.memoryStorage({
  destination: function (req, file, cb) {
    cb(null, "/"); // Specify the destination directory where uploaded files will be stored
  },
});

const uploadSingle = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 50,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "file"));
  },
}).single("file"); // Đổi thành 'file' để hỗ trợ mọi định dạng
=======
const storage = multer.memoryStorage();

const uploader = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 50,
  },
});

const upload = (req, res, next) => {
  uploader.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
    { name: "avatar", maxCount: 1 },
  ])(req, res, (error) => {
    if (error) {
      return next(error);
    }

    const files = req.files || {};
    req.file =
      files.file?.[0] ||
      files.image?.[0] ||
      files.avatar?.[0] ||
      null;

    return next();
  });
};
>>>>>>> 2727221cf4e82083ffaf07c301c71dadc77e216c

const upload = (req, res, next) => {
  uploadSingle(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ message: "File quá lớn. Tối đa 50MB." });
        return;
      }

      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        res.status(400).json({
          message: "Định dạng file không hỗ trợ. Chỉ chấp nhận ảnh/video phổ biến.",
        });
        return;
      }
    }

    res.status(500).json({ message: "Upload middleware failed" });
  });
};

module.exports = upload;
