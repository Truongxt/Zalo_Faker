const express = require("express");
const router = express.Router();
const GroupController = require("../controllers/groupController");
const auth = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");

router.use(auth);

router.post("/", upload, GroupController.createGroup);
router.put("/:id/rename", GroupController.renameGroup);
router.put("/:id/avatar", GroupController.updateAvatar);
router.put("/:id/add-member", GroupController.addMember);
router.put("/:id/remove-member", GroupController.removeMember);
router.put("/:id/transfer-admin", GroupController.transferAdmin);
router.put("/:id/appoint-deputy", GroupController.appointDeputy);
router.put("/:id/revoke-deputy", GroupController.revokeDeputy);
router.put("/:id/leave", GroupController.leaveGroup);
router.delete("/:id/dissolve", GroupController.dissolveGroup);
router.get("/:id/members", GroupController.getGroupMembers);
router.get("/", GroupController.getGroups);

module.exports = router;
