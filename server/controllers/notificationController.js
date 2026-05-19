const notificationService = require("../services/notificationService");

const getRequesterId = (req) => req.user?.userId;

const handleError = (res, error) =>
  res.status(error.statusCode || 500).json({
    message: error.message,
  });

const notificationController = {
  async listNotifications(req, res) {
    try {
      const result = await notificationService.listNotifications(
        getRequesterId(req),
        { limit: req.query?.limit },
      );
      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  async markAsRead(req, res) {
    try {
      const result = await notificationService.markAsRead(
        req.params.notificationId,
        getRequesterId(req),
      );
      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  async markAllAsRead(req, res) {
    try {
      const result = await notificationService.markAllAsRead(getRequesterId(req));
      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },
};

module.exports = notificationController;
