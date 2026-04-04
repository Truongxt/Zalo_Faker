const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const authMiddleware = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");

router.use(authMiddleware);

// Middleware `upload` là multer đã bind sẵn logic single("file")
router.post("/", upload, uploadController.uploadFile);

module.exports = router;
