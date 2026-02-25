const SubjectModel = require("../models/user"); // Import SubjectModel từ models
const { uploadFile } = require("../service/file.service"); // Import uploadFile từ service

const SubjectController = {
  // [GET] /subjects - Lấy danh sách tất cả subjects
  getAllSubjects: async (req, res) => {
    try {
      const subjects = await SubjectModel.getSubjects();
      res.render("index", { subjects }); // Render view với dữ liệu subjects
    } catch (error) {
      console.error("Error getting subjects:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  },

  // [GET] /subjects/:id - Lấy chi tiết một subject
  getOneSubject: async (req, res) => {
    try {
      const { id } = req.params;
      const subject = await SubjectModel.getOneSubject(id);
      if (!subject) {
        return res.status(404).json({ success: false, message: "Subject not found" });
      }
      res.json({ success: true, data: subject });
    } catch (error) {
      console.error("Error getting subject:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  },

  // [POST] /subjects - Tạo mới subject
  createSubject: async (req, res) => {
    try {
      const { name, type, semester, faculty } = req.body;
      let imageUrl = "";

      // Nếu có file upload thì upload lên S3
      if (req.file) {
        imageUrl = await uploadFile(req.file);
      }

      const subjectData = {
        name,
        type,
        semester,
        faculty,
        image: imageUrl,
      };

      const newSubject = await SubjectModel.createSubject(subjectData);
      res.status(201).json({ success: true, data: newSubject });
    } catch (error) {
      console.error("Error creating subject:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  },

  // [PUT] /subjects/:id - Cập nhật subject
  updateSubject: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, type, semester, faculty } = req.body;
      let imageUrl = req.body.image || "";

      // Nếu có file upload mới thì upload lên S3
      if (req.file) {
        imageUrl = await uploadFile(req.file);
      }

      const subjectData = {
        name,
        type,
        semester,
        faculty,
        image: imageUrl,
      };

      const updatedSubject = await SubjectModel.updateSubject(id, subjectData);
      res.json({ success: true, data: updatedSubject });
    } catch (error) {
      console.error("Error updating subject:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  },

  // [DELETE] /subjects/:id - Xoá subject
  deleteSubject: async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body; // Cần name vì DynamoDB có sort key
      await SubjectModel.deleteSubject(id, name);
      res.json({ success: true, message: "Subject deleted successfully" });
    } catch (error) {
      console.error("Error deleting subject:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  },
};

module.exports = SubjectController;
