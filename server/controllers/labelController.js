const labelService = require("../services/labelService");

const labelController = {
  createLabel: async (req, res) => {
    try {
      const { name, color } = req.body;
      const data = {
        userId: req.user.id,
        name,
        color
      };
      const label = await labelService.createLabel(data);
      res.status(201).json(label);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  getLabels: async (req, res) => {
    try {
      const labels = await labelService.getLabelsByUserId(req.user.id);
      res.json(labels);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  updateLabel: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, color } = req.body;
      const updated = await labelService.updateLabel(id, { name, color });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  deleteLabel: async (req, res) => {
    try {
      const { id } = req.params;
      // TODO: Có thể cần xóa tham chiếu labelId trong các cuộc trò chuyện trước khi xóa Label
      const result = await labelService.deleteLabel(id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
};

module.exports = labelController;
