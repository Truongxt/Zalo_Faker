const express = require("express");
const auth = require("../middlewares/authMiddleware");
const aiController = require("../controllers/aiController");

const router = express.Router();

router.post("/ask", auth, aiController.askAssistant);

module.exports = router;
