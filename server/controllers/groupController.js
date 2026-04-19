const GroupService = require("../services/groupService");
const { uploadFile } = require("../services/file.service");

const getRequesterId = (req) => req.user?.userId;

const handleError = (res, error) => {
  return res.status(error.statusCode || 500).json({
    message: error.message
  });
};

const GroupController = {
  createGroup: async (req, res) => {
    try {
      const memberIds =
        typeof req.body.memberIds === "string"
          ? JSON.parse(req.body.memberIds)
          : req.body.memberIds;
      const avatar = req.file
        ? await uploadFile(req.file, {
            folder: "groups",
            subfolder: getRequesterId(req),
          })
        : req.body.avatar;

      const group = await GroupService.createGroup({
        ...req.body,
        memberIds,
        avatar,
        createdBy: getRequesterId(req)
      });

      return res.status(201).json(group);
    } catch (error) {
      return handleError(res, error);
    }
  },

  renameGroup: async (req, res) => {
    try {
      const group = await GroupService.renameGroup(req.params.id, {
        name: req.body.name,
        userId: getRequesterId(req)
      });

      return res.json(group);
    } catch (error) {
      return handleError(res, error);
    }
  },

  updateAvatar: async (req, res) => {
    try {
      const group = await GroupService.updateAvatar(req.params.id, {
        avatar: req.body.avatar,
        userId: getRequesterId(req)
      });

      return res.json(group);
    } catch (error) {
      return handleError(res, error);
    }
  },

  addMember: async (req, res) => {
    try {
      const group = await GroupService.addMember(req.params.id, {
        newUserId: req.body.newUserId,
        userId: getRequesterId(req)
      });

      return res.json(group);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getGroupSettings: async (req, res) => {
    try {
      const result = await GroupService.getGroupSettings(req.params.id, {
        userId: getRequesterId(req)
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  rotateInviteCode: async (req, res) => {
    try {
      const result = await GroupService.rotateInviteCode(req.params.id, {
        userId: getRequesterId(req)
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  updateInviteSettings: async (req, res) => {
    try {
      const result = await GroupService.updateInviteSettings(req.params.id, {
        userId: getRequesterId(req),
        approvalRequired: req.body.approvalRequired
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  requestJoinByInviteCode: async (req, res) => {
    try {
      const result = await GroupService.requestJoinByInviteCode({
        inviteCode: req.body.inviteCode,
        userId: getRequesterId(req)
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getJoinRequests: async (req, res) => {
    try {
      const result = await GroupService.getJoinRequests(req.params.id, {
        userId: getRequesterId(req),
        includeResolved: req.query.includeResolved === "true"
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  reviewJoinRequest: async (req, res) => {
    try {
      const result = await GroupService.reviewJoinRequest(req.params.id, {
        requestId: req.params.requestId,
        action: req.body.action,
        userId: getRequesterId(req)
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  updateGroupPermissions: async (req, res) => {
    try {
      const result = await GroupService.updateGroupPermissions(req.params.id, {
        userId: getRequesterId(req),
        permissions: req.body
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  pinMessage: async (req, res) => {
    try {
      const result = await GroupService.pinMessage(req.params.id, {
        messageId: req.body.messageId,
        userId: getRequesterId(req)
      });

      const io = req.app.get("io");
      if (io) {
        io.to(`conv:${req.params.id}`).emit("chat:pinned_message", {
          conversationId: req.params.id,
          pinnedMessage: result.pinnedMessage,
          updatedBy: getRequesterId(req)
        });
      }

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  unpinMessage: async (req, res) => {
    try {
      const result = await GroupService.unpinMessage(req.params.id, {
        userId: getRequesterId(req)
      });

      const io = req.app.get("io");
      if (io) {
        io.to(`conv:${req.params.id}`).emit("chat:pinned_message", {
          conversationId: req.params.id,
          pinnedMessage: null,
          updatedBy: getRequesterId(req)
        });
      }

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  removeMember: async (req, res) => {
    try {
      const result = await GroupService.removeMember(req.params.id, {
        removeUserId: req.body.removeUserId,
        userId: getRequesterId(req)
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  transferAdmin: async (req, res) => {
    try {
      const result = await GroupService.transferAdmin(req.params.id, {
        newAdminUserId: req.body.newAdminUserId,
        userId: getRequesterId(req)
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  appointDeputy: async (req, res) => {
    try {
      const result = await GroupService.appointDeputy(req.params.id, {
        deputyUserId: req.body.deputyUserId,
        userId: getRequesterId(req)
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  revokeDeputy: async (req, res) => {
    try {
      const result = await GroupService.revokeDeputy(req.params.id, {
        deputyUserId: req.body.deputyUserId,
        userId: getRequesterId(req)
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getGroupMembers: async (req, res) => {
    try {
      const result = await GroupService.getGroupMembers(req.params.id, {
        role: req.query.role,
        userId: getRequesterId(req)
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  leaveGroup: async (req, res) => {
    try {
      const result = await GroupService.leaveGroup(req.params.id, {
        userId: getRequesterId(req)
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  dissolveGroup: async (req, res) => {
    try {
      const result = await GroupService.dissolveGroup(req.params.id, {
        userId: getRequesterId(req)
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getGroups: async (req, res) => {
    try {
      const groups = await GroupService.getGroups(getRequesterId(req));
      return res.json(groups);
    } catch (error) {
      return handleError(res, error);
    }
  }
};

module.exports = GroupController;
