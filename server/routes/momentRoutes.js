const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");
const momentController = require("../controllers/momentController");

router.use(auth);

router.post("/", upload, momentController.createMoment);
router.put("/:momentId", upload, momentController.updateMoment);
router.get("/friends", momentController.getFriendMoments);
router.get("/me", momentController.getMyProfile);
router.get("/user/:userId", momentController.getUserProfile);
router.get("/reacted", momentController.getReactedMoments);
router.get("/:momentId/comments", momentController.getMomentComments);
router.post("/:momentId/comments", momentController.commentMoment);
router.delete("/:momentId/comments/:commentId", momentController.deleteComment);
router.put("/:momentId/comments/:commentId/reaction", momentController.reactToComment);
router.post("/:momentId/share", momentController.shareMoment);
router.put("/:momentId/reaction", momentController.reactToMoment);
router.delete("/:momentId", momentController.deleteMoment);

module.exports = router;
