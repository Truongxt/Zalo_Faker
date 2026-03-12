const express= require("express")
const router=express.Router()
const auth = require("../middlewares/authMiddleware");
const friendController= require("../controllers/friendController")

router.post("/requests",auth, friendController.sendFriendRequest);
router.post("/requests/accept", auth, friendController.acceptFriendRequest);
router.get("/friends/:userId", auth, friendController.getFriends);
router.get("/requests/pending/:userId", auth, friendController.getPendingRequests);
module.exports=router