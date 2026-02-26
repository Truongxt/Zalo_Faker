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
  }
};

module.exports = userController;