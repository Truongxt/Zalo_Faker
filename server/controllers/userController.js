const { get } = require("../routes/friendRoutes");
const userService = require("../services/userService");
const qrLoginService = require("../services/qrLoginService");

const userController = {

  // ===== REGISTER =====
  register: async (req, res) => {
    try {
      const user = await userService.register(req.body);
      res.status(201).json(user);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  // ===== LOGIN =====
  login: async (req, res) => {
    try {
      const { email, phone, identifier, password, platform, deviceInfo } = req.body;
      const loginIdentifier = String(identifier || email || phone || "").trim();

      // Extract device info from request
      const loginMeta = {
        platform: platform || req.headers["x-platform"] || "web",
        deviceInfo: deviceInfo || req.headers["x-device-info"] || req.headers["user-agent"] || "Unknown",
        ipAddress: req.headers["x-forwarded-for"] || req.connection?.remoteAddress || req.ip || "Unknown",
      };

      const result = await userService.login(loginIdentifier, password, loginMeta);
      res.json(result);
    } catch (err) {
      res.status(401).json({ message: err.message });
    }
  },

  // ===== LOGOUT =====
  logout: async (req, res) => {
    try {
      const { refreshToken } = req.body;
      const result = await userService.logout(refreshToken);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  // ===== GET ALL USERS =====
  getUsers: async (req, res) => {
    try {
      const users = await userService.getUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // ===== UPDATE USER =====
  updateUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const updated = await userService.updateUser(userId, req.body, req.file);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  // ===== DELETE USER =====
  deleteUser: async (req, res) => {
    try {
      const { userId } = req.params;
      if (!req.user?.userId || String(req.user.userId) !== String(userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const result = await userService.deleteUser(userId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
  getUserByPhone: async (req, res) => {
    try {
      const { phone } = req.params;
      const user = await userService.getByPhone(phone);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
      console.log(" find user phone ", user);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
},
getUserById: async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await userService.getById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }},
  suggestFriendsByPhones: async (req, res) => {
    try {
      const requesterId = req.user?.userId || req.user?.id;
      const { phones } = req.body || {};

      if (!Array.isArray(phones)) {
        return res.status(400).json({ message: "phones must be an array" });
      }

      const users = await userService.suggestFriendsByPhones(requesterId, phones);
      res.json({ data: users });
    } catch (err) {
      const message = err.message || "Failed to suggest friends";
      const status = /required|array/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  createQrLoginSession: async (_req, res) => {
    try {
      const session = await qrLoginService.createSession();
      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ message: err.message || "Failed to create QR login session" });
    }
  },

  getQrLoginSessionStatus: async (req, res) => {
    try {
      const { sessionId } = req.params || {};
      const pollToken = req.query?.pollToken;
      const result = await qrLoginService.getSessionStatus({ sessionId, pollToken });
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to get QR login status";
      const status = /required|invalid session/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  confirmQrLogin: async (req, res) => {
    try {
      const { sessionId, confirmCode, code } = req.body || {};
      const userId = req.user?.userId || req.user?.id;
      const result = await qrLoginService.confirmSession({
        sessionId,
        confirmCode: confirmCode || code,
        userId,
        deviceInfo: req.headers["user-agent"] || "Mobile",
        ipAddress: req.headers["x-forwarded-for"] || req.connection?.remoteAddress || req.ip || "Unknown",
      });
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to confirm QR login";
      const status = /required|invalid|expired|no longer available/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  // ===== REFRESH TOKEN =====
  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token is required" });
      }
      const result = await userService.refreshToken(refreshToken);
      res.json(result);
    } catch (err) {
      res.status(401).json({ message: err.message });
    }
  },

  forgotPasswordRequestOtp: async (req, res) => {
    try {
      const { email } = req.body || {};
      const result = await userService.forgotPasswordRequestOtp(email);
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to send OTP";
      const status = /wait|required|not found/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  forgotPasswordVerifyOtp: async (req, res) => {
    try {
      const { email, otp } = req.body || {};
      const result = await userService.forgotPasswordVerifyOtp(email, otp);
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to verify OTP";
      const status = /required|expired|invalid|not found/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  forgotPasswordReset: async (req, res) => {
    try {
      const { email, newPassword } = req.body || {};
      const result = await userService.forgotPasswordReset(email, newPassword);
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to reset password";
      const status = /required|not found|verification/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  // ===== CHANGE PASSWORD =====
  changePassword: async (req, res) => {
    try {
      const { userId } = req.params;
      const { oldPassword, newPassword } = req.body || {};
      const result = await userService.changePassword(userId, oldPassword, newPassword);
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to change password";
      const status = /required|not found|incorrect/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  // ===== LOCK ACCOUNT =====
  lockAccount: async (req, res) => {
    try {
      const { userId } = req.params;
      const { currentPassword } = req.body || {};

      if (!req.user?.userId || String(req.user.userId) !== String(userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const result = await userService.lockAccount(userId, currentPassword);
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to lock account";
      const status = /required|not found|incorrect/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  requestPermanentLockOtp: async (req, res) => {
    try {
      const { userId } = req.params;

      if (!req.user?.userId || String(req.user.userId) !== String(userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const result = await userService.requestPermanentLockOtp(userId);
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to send lock OTP";
      const status = /required|not found|wait|already/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  permanentLockAccount: async (req, res) => {
    try {
      const { userId } = req.params;
      const { password, otp, confirmIrreversible } = req.body || {};

      if (!req.user?.userId || String(req.user.userId) !== String(userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const result = await userService.permanentLockAccount(
        userId,
        password,
        otp,
        confirmIrreversible,
      );
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to permanently lock account";
      const status = /required|not found|incorrect|invalid|expired|confirm|already/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  // ===== UNLOCK ACCOUNT =====
  unlockAccount: async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const result = await userService.unlockAccount(email, password);
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to unlock account";
      const status = /required|not found|incorrect|not locked/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  // ===== REGISTRATION WITH OTP =====
  registerRequestOtp: async (req, res) => {
    try {
      const { email } = req.body || {};
      const result = await userService.registerRequestOtp(email);
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to send OTP";
      const status = /required|exists|already|wait|invalid|disposable|domain/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  registerVerifyOtp: async (req, res) => {
    try {
      const { email, otp } = req.body || {};
      const result = await userService.registerVerifyOtp(email, otp);
      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to verify OTP";
      const status = /required|expired|invalid|not found/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  registerComplete: async (req, res) => {
    try {
      const result = await userService.registerComplete(req.body);
      res.status(201).json(result);
    } catch (err) {
      const message = err.message || "Failed to complete registration";
      const status = /required|verification|expired|exists|already/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }  },

  // ===== LOGIN HISTORY =====
  getLoginHistory: async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit) || 20;

      // Only allow users to see their own login history
      if (!req.user?.userId || String(req.user.userId) !== String(userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const history = await userService.getLoginHistory(userId, limit);
      res.json(history);
    } catch (err) {
      const message = err.message || "Failed to get login history";
      const status = /required|not found/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  logoutLoginSession: async (req, res) => {
    try {
      const { userId, loginId } = req.params;
      const requesterId = req.user?.userId || req.user?.id;
      const requesterSessionId = req.user?.sessionId || "";

      if (!requesterId || String(requesterId) !== String(userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const result = await userService.logoutLoginSession(
        userId,
        loginId,
        requesterSessionId,
      );

      res.json(result);
    } catch (err) {
      const message = err.message || "Failed to logout session";
      const status = /required|not found|forbidden/i.test(message) ? 400 : 500;
      res.status(status).json({ message });
    }
  },

  // ===== HIDDEN CHAT PIN =====
  getHiddenPinStatus: async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await userService.getById(userId);
      res.json({ isSet: !!user?.hiddenChatPin });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  updateHiddenPin: async (req, res) => {
    try {
      const { userId } = req.params;
      const { pin } = req.body;
      if (!pin || pin.length !== 6) {
        return res.status(400).json({ message: "PIN phải có 6 số" });
      }
      await userService.updateUser(userId, { hiddenChatPin: pin });
      res.json({ message: "Đã cập nhật mã PIN" });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  verifyHiddenPin: async (req, res) => {
    try {
      const { userId } = req.params;
      const { pin } = req.body;
      const user = await userService.getById(userId);
      if (user?.hiddenChatPin === pin) {
        res.json({ success: true });
      } else {
        res.status(401).json({ success: false, message: "Mã PIN không chính xác" });
      }
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
  
  resetHiddenPin: async (req, res) => {
    try {
      const { userId } = req.params;
      const { password, newPin } = req.body;
      
      const isPasswordCorrect = await userService.comparePassword(userId, password);
      if (!isPasswordCorrect) {
        return res.status(401).json({ success: false, message: "Mật khẩu không chính xác" });
      }
      
      if (!newPin || newPin.length !== 6) {
        return res.status(400).json({ message: "Mã PIN mới phải có 6 số" });
      }
      
      await userService.updateUser(userId, { hiddenChatPin: newPin });
      res.json({ success: true, message: "Đã đặt lại mã PIN thành công" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },


}
module.exports = userController;
