const express = require("express");
const router = express.Router();
const GroupController = require("../controllers/groupController");
const authMiddleware = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");

router.use(authMiddleware);

router.post("/join-by-invite", GroupController.requestJoinByInviteCode);
router.post("/", upload, GroupController.createGroup);
router.get("/:id/settings", GroupController.getGroupSettings);
router.patch("/:id/settings/permissions", GroupController.updateGroupPermissions);
router.patch("/:id/settings/invite", GroupController.updateInviteSettings);
router.post("/:id/invite/rotate", GroupController.rotateInviteCode);
router.get("/:id/join-requests", GroupController.getJoinRequests);
router.post("/:id/join-requests/:requestId/review", GroupController.reviewJoinRequest);
router.put("/:id/pin-message", GroupController.pinMessage);
router.delete("/:id/pin-message", GroupController.unpinMessage);
router.put("/:id/rename", GroupController.renameGroup);
router.put("/:id/avatar", GroupController.updateAvatar);
router.put("/:id/add-member", GroupController.addMember);
router.put("/:id/remove-member", GroupController.removeMember);
router.put("/:id/transfer-admin", GroupController.transferAdmin);
router.put("/:id/appoint-deputy", GroupController.appointDeputy);
router.put("/:id/revoke-deputy", GroupController.revokeDeputy);
router.get("/:id/members", GroupController.getGroupMembers);
router.put("/:id/leave", GroupController.leaveGroup);
router.delete("/:id", GroupController.dissolveGroup);
router.get("/", async (req, res) => {
  try {
    const ConversationModel = require("../models/conversation.js");
    const conversations = await ConversationModel.getConversations();
    const groups = conversations.filter(c => c.type === "group" && c.participants && c.participants.some(p => p.userId === req.user.userId));

    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
