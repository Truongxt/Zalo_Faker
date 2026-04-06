const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const auth = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");

/**
 * @swagger
 * tags:
 *   - name: User
 *     description: API quản lý người dùng
 */

/**
 * @swagger
 * /users/register:
 *   post:
 *     summary: Đăng ký tài khoản
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo user thành công
 */
router.post("/register", userController.register);


/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user1@zalo-faker.com
 *               password:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Login thành công
 */
router.post("/login", userController.login);


/**
 * @swagger
 * /users/logout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout thành công
 */
router.post("/logout", userController.logout);


/**
 * @swagger
 * /users/refresh-token:
 *   post:
 *     summary: Refresh token
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Thành công
 */
router.post("/refresh-token", userController.refreshToken);
router.post("/forgot-password/request-otp", userController.forgotPasswordRequestOtp);
router.post("/forgot-password/verify-otp", userController.forgotPasswordVerifyOtp);
router.post("/forgot-password/reset", userController.forgotPasswordReset);


/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lấy danh sách user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/", auth, userController.getUsers);


/**
 * @swagger
 * /users/{userId}:
 *   put:
 *     summary: Cập nhật user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: number
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Thành công
 */
router.put("/:userId", auth, upload, userController.updateUser);


/**
 * @swagger
 * /users/{userId}:
 *   delete:
 *     summary: Xóa user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
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
router.delete("/:userId", auth, userController.deleteUser);


/**
 * @swagger
 * /users/phone/{phone}:
 *   get:
 *     summary: Tìm user theo số điện thoại
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/phone/:phone", auth, userController.getUserByPhone);


/**
 * @swagger
 * /users/id/{userId}:
 *   get:
 *     summary: Tìm user theo ID
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
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
router.get("/id/:userId", auth, userController.getUserById);

module.exports = router;