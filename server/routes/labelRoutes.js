const express = require("express");
const router = express.Router();
const labelController = require("../controllers/labelController");
const authMiddleware = require("../middlewares/authMiddleware");

router.use(authMiddleware);

router.post("/", labelController.createLabel);
router.get("/", labelController.getLabels);
router.put("/:id", labelController.updateLabel);
router.delete("/:id", labelController.deleteLabel);

module.exports = router;
