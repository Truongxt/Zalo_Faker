const { get } = require("../routes/friendRoutes");
const userService = require("../services/userService");

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
      const { email, password } = req.body;
      const result = await userService.login(email, password);
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
      const updated = await userService.updateUser(userId, req.body);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  // ===== DELETE USER =====
  deleteUser: async (req, res) => {
    try {
      const { userId } = req.params;
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
  }

}
module.exports = userController;