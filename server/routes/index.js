const express = require("express");
const router = express.Router();
const SubjectController = require("../controllers/index");
const upload = require("../middleware/upload");

// ==================== SUBJECT ROUTES ====================

// [GET] / - Trang chủ hiển thị danh sách subjects
router.get("/", SubjectController.getAllSubjects);

// [GET] /subjects/:id - Lấy chi tiết một subject
router.get("/subjects/:id", SubjectController.getOneSubject);

// [POST] /subjects - Tạo mới subject (có upload ảnh)
router.post("/subjects", upload, SubjectController.createSubject);

// [PUT] /subjects/:id - Cập nhật subject (có upload ảnh)
router.put("/subjects/:id", upload, SubjectController.updateSubject);

// [DELETE] /subjects/:id - Xoá subject
router.delete("/subjects/:id", SubjectController.deleteSubject);

module.exports = router;
