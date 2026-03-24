const express= require("express")
const router=express.Router()
const auth = require("../middlewares/authMiddleware");
const friendController= require("../controllers/friendController")

router.post("/requests",auth, friendController.sendFriendRequest);
router.post("/requests/accept", auth, friendController.acceptFriendRequest);
router.get("/requests/pending/:userId", auth, friendController.getPendingRequests);
router.get("/check", auth, friendController.getExitingFriend);
router.get("/:userId", auth, friendController.getFriends);
module.exports=router