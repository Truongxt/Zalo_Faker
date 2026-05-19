const express = require("express");
const auth = require("../middlewares/authMiddleware");
const notificationController = require("../controllers/notificationController");

const router = express.Router();

router.use(auth);

router.get("/", notificationController.listNotifications);
router.patch("/read-all", notificationController.markAllAsRead);
router.patch("/:notificationId/read", notificationController.markAsRead);

module.exports = router;
