const multer = require("multer");

// Set up Multer storage options
// Sử dụng memoryStorage sẽ giúp chúng ta thao tác với các tập tin trước khi lưu 
// vào bộ nhớ hoặc database
const storage = multer.memoryStorage({
  destination: function (req, file, cb) {
    cb(null, "/"); // Specify the destination directory where uploaded files will be stored
  },
});

// Create Multer middleware instance for single file upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 50, // Nâng giới hạn lên 50MB cho video
  },
}).single("file"); // Đổi thành 'file' để hỗ trợ mọi định dạng

module.exports = upload;
