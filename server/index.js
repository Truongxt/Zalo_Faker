require("dotenv").config(); // Load biến môi trường từ file .env
const express = require("express");
const path = require("path");
const routes = require("./routes"); // Import routes

const app = express(); // Khởi tạo hệ thống bằng express
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(express.json({ extended: false })); // Parse application/json
app.use(express.urlencoded({ extended: true })); // Parse application/x-www-form-urlencoded

// ==================== VIEW ENGINE ====================
app.set("view engine", "ejs"); // Sử dụng EJS làm template engine
app.set("views", path.join(__dirname, "views")); // Thư mục chứa views

// ==================== STATIC FILES ====================
app.use(express.static(path.join(__dirname, "public"))); // Thư mục chứa file tĩnh (css, js, images)

// ==================== ROUTES ====================
app.use("/", routes); // Sử dụng routes đã định nghĩa

// ==================== ERROR HANDLING ====================
// Middleware xử lý 404 - Route không tồn tại
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Middleware xử lý lỗi chung
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}/`);
});
