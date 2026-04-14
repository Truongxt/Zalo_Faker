const express= require("express")
const router=express.Router()
const auth = require("../middlewares/authMiddleware");
const friendController= require("../controllers/friendController")

/**
 * @swagger
 * /requests:
 *   post:
 *     summary: Gửi lời mời kết bạn
 *     tags: [Friend]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromUserId:
 *                 type: number
 *               toUserId:
 *                 type: number
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Gửi thành công
 */
router.post("/requests",auth, friendController.sendFriendRequest);


/**
 * @swagger
 * /requests/accept:
 *   post:
 *     summary: Chấp nhận lời mời kết bạn
 *     tags: [Friend]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromUserId:
 *                 type: number
 *               toUserId:
 *                 type: number
 *     responses:
 *       200:
 *         description: Thành công
 */
router.post("/requests/accept", auth, friendController.acceptFriendRequest);

/**
 * @swagger
 * /requests/reject:
 *   post:
 *     summary: Từ chối lời mời kết bạn
 *     tags: [Friend]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromUserId:
 *                 type: number
 *               toUserId:
 *                 type: number
 *     responses:
 *       200:
 *         description: Thành công
 */
router.post("/requests/reject", auth, friendController.rejectFriendRequest);
router.delete("/:friendId", auth, friendController.removeFriend);
router.post("/block/:targetUserId", auth, friendController.blockUser);
router.delete("/block/:targetUserId", auth, friendController.unblockUser);
router.get("/blocked/:userId", auth, friendController.getBlockedUsers);


/**
 * @swagger
 * /requests/pending/{userId}:
 *   get:
 *     summary: Lấy danh sách lời mời đang chờ
 *     tags: [Friend]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/requests/pending/:userId", auth, friendController.getPendingRequests);


/**
 * @swagger
 * /check:
 *   get:
 *     summary: Kiểm tra quan hệ bạn bè
 *     tags: [Friend]
 *     parameters:
 *       - in: query
 *         name: userId1
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: userId2
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/check", auth, friendController.getExitingFriend);


/**
 * @swagger
 * /friends/{userId}:
 *   get:
 *     summary: Lấy danh sách bạn bè
 *     tags: [Friend]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/:userId", auth, friendController.getFriends);

module.exports=router
