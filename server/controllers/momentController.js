const momentService = require("../services/momentService");
const { deleteFiles, uploadFiles } = require("../services/file.service");

const getRequesterId = (req) => req.user?.userId;

const handleError = (res, error) =>
  res.status(error.statusCode || 500).json({
    message: error.message
  });

const parseMediaUrls = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
      return trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const MomentController = {
  createMoment: async (req, res) => {
    try {
      const body = req.body || {};
      const mediaUrls = parseMediaUrls(body.mediaUrls);
      const requesterId = getRequesterId(req);
      const uploadedFiles = Array.isArray(req.uploadedFiles)
        ? req.uploadedFiles
        : req.file
          ? [req.file]
          : [];

      if (uploadedFiles.length) {
        const mediaFolder = `${requesterId || "anonymous"}/${Date.now()}`;
        const uploadedUrls = await uploadFiles(uploadedFiles, {
          folder: "moments",
          subfolder: mediaFolder,
        });
        mediaUrls.push(...uploadedUrls);
      }

      const moment = await momentService.createMoment({
        userId: requesterId,
        content: body.content,
        mediaUrls
      });

      return res.status(201).json(moment);
    } catch (error) {
      return handleError(res, error);
    }
  },

  updateMoment: async (req, res) => {
    let newMediaUrls = [];

    try {
      const body = req.body || {};
      const requesterId = getRequesterId(req);
      const retainMediaUrls = parseMediaUrls(body.retainMediaUrls);
      const uploadedFiles = Array.isArray(req.uploadedFiles)
        ? req.uploadedFiles
        : req.file
          ? [req.file]
          : [];

      if (uploadedFiles.length) {
        const mediaFolder = `${requesterId || "anonymous"}/${req.params.momentId}-${Date.now()}`;
        newMediaUrls = await uploadFiles(uploadedFiles, {
          folder: "moments",
          subfolder: mediaFolder,
        });
      }

      const moment = await momentService.updateMoment(
        req.params.momentId,
        requesterId,
        {
          content: body.content,
          retainMediaUrls,
          newMediaUrls
        }
      );

      return res.json(moment);
    } catch (error) {
      if (newMediaUrls.length > 0) {
        try {
          await deleteFiles(newMediaUrls);
        } catch (cleanupError) {
          console.warn("Failed to rollback uploaded moment media:", cleanupError.message);
        }
      }

      return handleError(res, error);
    }
  },

  getFriendMoments: async (req, res) => {
    try {
      const moments = await momentService.getFriendMoments(getRequesterId(req));
      return res.json(moments);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getMyProfile: async (req, res) => {
    try {
      const profile = await momentService.getMyProfile(getRequesterId(req));
      return res.json(profile);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getUserProfile: async (req, res) => {
    try {
      const profile = await momentService.getUserProfile(
        req.params.userId,
        getRequesterId(req)
      );
      return res.json(profile);
    } catch (error) {
      return handleError(res, error);
    }
  },

  deleteMoment: async (req, res) => {
    try {
      const result = await momentService.deleteMoment(req.params.momentId, getRequesterId(req));
      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  reactToMoment: async (req, res) => {
    try {
      const body = req.body || {};
      const result = await momentService.reactToMoment(
        req.params.momentId,
        getRequesterId(req),
        body.emoji
      );
      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  commentMoment: async (req, res) => {
    try {
      const body = req.body || {};
      const result = await momentService.commentMoment(
        req.params.momentId,
        getRequesterId(req),
        body.content,
        body.replyToCommentId
      );
      return res.status(201).json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  reactToComment: async (req, res) => {
    try {
      const body = req.body || {};
      const result = await momentService.reactToComment(
        req.params.momentId,
        req.params.commentId,
        getRequesterId(req),
        body.emoji
      );
      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  deleteComment: async (req, res) => {
    try {
      const result = await momentService.deleteComment(
        req.params.momentId,
        req.params.commentId,
        getRequesterId(req)
      );
      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getMomentComments: async (req, res) => {
    try {
      const comments = await momentService.getMomentComments(
        req.params.momentId,
        getRequesterId(req)
      );
      return res.json(comments);
    } catch (error) {
      return handleError(res, error);
    }
  },

  shareMoment: async (req, res) => {
    try {
      const body = req.body || {};
      const result = await momentService.shareMoment(
        req.params.momentId,
        getRequesterId(req),
        body.caption
      );
      return res.status(201).json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getReactedMoments: async (req, res) => {
    try {
      const moments = await momentService.getReactedMoments(getRequesterId(req));
      return res.json(moments);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getMomentReactions: async (req, res) => {
    try {
      const reactions = await momentService.getMomentReactions(req.params.momentId, getRequesterId(req));
      return res.json(reactions);
    } catch (error) {
      return handleError(res, error);
    }
  }
};

module.exports = MomentController;
