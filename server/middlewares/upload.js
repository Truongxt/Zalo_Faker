const multer = require("multer");

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

module.exports = upload;
