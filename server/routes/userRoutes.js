const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const auth = require("../middlewares/authMiddleware");

router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/logout", userController.logout);

router.get("/", auth, userController.getUsers);
router.put("/:userId", auth, userController.updateUser);
router.delete("/:userId", auth, userController.deleteUser);
router.get("/phone/:phone", auth, userController.getUserByPhone);
router.get("/id/:userId", auth, userController.getUserById);
module.exports = router;