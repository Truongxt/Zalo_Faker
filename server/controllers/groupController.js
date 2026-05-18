const GroupService = require("../services/groupService");
const { uploadFile } = require("../services/file.service");
const { emitToUser } = require("../utils/socketEmitter");

const getRequesterId = (req) => req.user?.userId;

const getUsername = async (userId) => {
  if (!userId) return "User";
  try {
    const userService = require("../services/userService");
    const user = await userService.getById(userId);
    return user?.fullName || user?.userName || userId;
  } catch(e) {
    return userId;
  }
};

const createSystemMessage = async (req, conversationId, actionText, extraMetadata = {}) => {
  try {
    const messageService = require("../services/messageService");
    const conversationModel = require("../models/conversation");
    
    const actorName = await getUsername(getRequesterId(req));
    const text = `${actorName} ${actionText}`;
    
    const payload = {
        conversationId,
        senderId: 'system',
        type: 'system',
        content: text,
        metadata: { isAnnouncement: true, ...extraMetadata }
    };
    const message = await messageService.createMessage(payload);
    const normalizedMessage = { ...message, id: message._id };
    
    await conversationModel.updateConversation(conversationId, {
        lastMessage: {
            content: `[Thông báo] ${text}`,
            type: "text",
            senderId: 'system',
            timestamp: message.createdAt,
        },
    });
    
    const io = req.app.get("io");
    if (io) {
        io.to(`conv:${conversationId}`).emit("chat:message", normalizedMessage);
        io.to(conversationId).emit("chat:message", normalizedMessage);
    }
  } catch(e) {
    console.error("Emit system message error:", e);
  }
};

const emitGroupConversationUpdate = (req, conversationId, updates = {}) => {
  try {
    const io = req.app.get("io");
    if (!io || !conversationId) return;

    const payload = {
      id: String(conversationId),
      ...updates,
    };

    io.to(`conv:${conversationId}`).emit("chat:update_conversation", payload);
    io.to(String(conversationId)).emit("chat:update_conversation", payload);
  } catch (error) {
    console.error("Emit group conversation update error:", error);
  }
};

const buildGroupConversationUpdates = (group) => ({
  participants: group?.participants,
  groupSettings: group?.groupSettings,
});

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
      await createSystemMessage(req, req.params.id, `đã đổi tên nhóm thành "${req.body.name}"`, { action: 'rename_group' });
      
      emitGroupConversationUpdate(req, req.params.id, {
        name: group?.name || req.body.name
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
      await createSystemMessage(req, req.params.id, "đã thay đổi ảnh đại diện nhóm", { action: 'update_avatar' });
      
      emitGroupConversationUpdate(req, req.params.id, {
        avatar: group?.avatar || req.body.avatar
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
      emitGroupConversationUpdate(req, req.params.id, buildGroupConversationUpdates(group));
      const targetName = await getUsername(req.body.newUserId);
      await createSystemMessage(req, req.params.id, `đã thêm ${targetName} vào nhóm`, { action: 'add_member' });
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
      emitGroupConversationUpdate(req, req.params.id, {
        groupSettings: result.group?.groupSettings,
      });
      await createSystemMessage(req, req.params.id, "đã làm mới liên kết tham gia nhóm", { action: 'rotate_invite_code' });
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
      emitGroupConversationUpdate(req, req.params.id, {
        groupSettings: result.group?.groupSettings,
      });
      await createSystemMessage(req, req.params.id, "đã thay đổi cài đặt phê duyệt tham gia nhóm", { action: 'update_invite_settings' });
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

      const targetGroupId = String(
        result?.group?._id || result?.group?.id || result?.groupId || ""
      );
      if (targetGroupId && result?.group) {
        emitGroupConversationUpdate(req, targetGroupId, {
          participants: result.group.participants,
          groupSettings: result.group.groupSettings,
        });
      }

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
      emitGroupConversationUpdate(req, req.params.id, {
        participants: result.group?.participants,
        groupSettings: result.group?.groupSettings,
      });
      await createSystemMessage(req, req.params.id, `đã ${req.body.action === 'approve' ? 'phê duyệt' : 'từ chối'} duyệt tham gia nhóm`, { action: 'review_join_request' });
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
      emitGroupConversationUpdate(req, req.params.id, buildGroupConversationUpdates(result.group));
      await createSystemMessage(req, req.params.id, "đã cập nhật quyền trong nhóm", { action: 'update_permissions' });
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
      const pinnedContent = result.pinnedMessage?.content;
      const previewText = typeof pinnedContent === 'string' ? pinnedContent : pinnedContent?.text || "";
      const displayPreview = previewText ? ` "${previewText.length > 30 ? previewText.substring(0, 30) + "..." : previewText}"` : "";

      await createSystemMessage(req, req.params.id, `đã ghim 1 tin nhắn${displayPreview}`, { action: 'pin' });
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
      let displayPreview = "";
      try {
        const groupModel = require("../models/conversation");
        const group = await groupModel.getById(req.params.id);
        const wasPinned = group?.groupSettings?.pinnedMessage;
        if (wasPinned) {
          const pinnedContent = wasPinned.content;
          const previewText = typeof pinnedContent === 'string' ? pinnedContent : pinnedContent?.text || "";
          if (previewText) {
            displayPreview = ` "${previewText.length > 30 ? previewText.substring(0, 30) + "..." : previewText}"`;
          }
        }
      } catch (e) {
        console.error("Error getting unpinned message preview:", e);
      }

      await createSystemMessage(req, req.params.id, `đã bỏ ghim 1 tin nhắn${displayPreview}`, { action: 'unpin' });
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
      emitGroupConversationUpdate(req, req.params.id, buildGroupConversationUpdates(result.group));
      const targetName = await getUsername(req.body.removeUserId);
      await createSystemMessage(req, req.params.id, `đã xóa ${targetName} khỏi nhóm`);
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
      emitGroupConversationUpdate(req, req.params.id, buildGroupConversationUpdates(result.group));
      const targetName = await getUsername(req.body.newAdminUserId);
      await createSystemMessage(req, req.params.id, `đã chuyển quyền trưởng nhóm cho ${targetName}`);
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
      emitGroupConversationUpdate(req, req.params.id, buildGroupConversationUpdates(result.group));
      const targetName = await getUsername(req.body.deputyUserId);
      await createSystemMessage(req, req.params.id, `đã bổ nhiệm ${targetName} làm phó nhóm`);
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
      emitGroupConversationUpdate(req, req.params.id, buildGroupConversationUpdates(result.group));
      const targetName = await getUsername(req.body.deputyUserId);
      await createSystemMessage(req, req.params.id, `đã tước quyền phó nhóm của ${targetName}`);
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
        userId: getRequesterId(req),
        newAdminUserId: req.body.newAdminUserId
      });
      emitGroupConversationUpdate(req, req.params.id, buildGroupConversationUpdates(result.group));
      await createSystemMessage(req, req.params.id, "đã rời nhóm");
      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  dissolveGroup: async (req, res) => {
    try {
      const groupId = String(req.params.id || "");
      const requesterId = getRequesterId(req);
      const memberSnapshot = await GroupService.getGroupMembers(groupId, {
        userId: requesterId
      });
      const memberIds = Array.from(
        new Set(
          (memberSnapshot?.members || [])
            .map((member) => String(member?.userId || ""))
            .filter(Boolean)
        )
      );

      const result = await GroupService.dissolveGroup(req.params.id, {
        userId: requesterId
      });

      const payload = {
        conversationId: groupId,
        groupId,
        dissolvedBy: String(requesterId || ""),
        dissolvedAt: new Date().toISOString(),
      };

      await Promise.all(
        memberIds.map(async (memberId) => {
          await emitToUser(memberId, "group:dissolved", payload);
          await emitToUser(memberId, "chat:conversation_removed", {
            ...payload,
            reason: "group_dissolved",
          });
        })
      );

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
