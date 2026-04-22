const crypto = require("crypto");
const { createParticipant } = require("../models/participant.js");
const GroupRepository = require("../repository/groupRepository");

const GROUP_ROLES = {
  ADMIN: "admin",
  DEPUTY: "deputy",
  MEMBER: "member"
};

const GROUP_PERMISSION_SCOPES = {
  ALL: "all",
  ADMIN_DEPUTY: "admin_deputy",
  ADMIN: "admin"
};

const VALID_GROUP_ROLES = Object.values(GROUP_ROLES);
const VALID_PERMISSION_SCOPES = Object.values(GROUP_PERMISSION_SCOPES);

const ROLE_RANKS = {
  [GROUP_ROLES.MEMBER]: 1,
  [GROUP_ROLES.DEPUTY]: 2,
  [GROUP_ROLES.ADMIN]: 3
};

const PERMISSION_SCOPE_RANKS = {
  [GROUP_PERMISSION_SCOPES.ALL]: 1,
  [GROUP_PERMISSION_SCOPES.ADMIN_DEPUTY]: 2,
  [GROUP_PERMISSION_SCOPES.ADMIN]: 3
};

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const ensureGroup = (conversation) => {
  if (!conversation || conversation.type !== "group") {
    throw createError("Group not found", 404);
  }

  return conversation;
};

const findParticipant = (group, userId) =>
  group?.participants?.find((participant) => participant.userId === userId);

const requireGroupMember = (group, userId) => {
  const participant = findParticipant(group, userId);

  if (!participant) {
    throw createError("You are not in this group", 403);
  }

  return participant;
};

const requireAdmin = (participant, message = "Only admin can perform this action") => {
  if (participant.role !== GROUP_ROLES.ADMIN) {
    throw createError(message, 403);
  }
};

const updateParticipantRole = (participants, targetUserId, nextRole) =>
  participants.map((participant) =>
    participant.userId === targetUserId
      ? { ...participant, role: nextRole }
      : participant
  );

const buildRoleSummary = (participants = []) =>
  participants.reduce(
    (summary, participant) => {
      if (VALID_GROUP_ROLES.includes(participant.role)) {
        summary[participant.role] += 1;
      }
      return summary;
    },
    {
      [GROUP_ROLES.ADMIN]: 0,
      [GROUP_ROLES.DEPUTY]: 0,
      [GROUP_ROLES.MEMBER]: 0
    }
  );

const generateInviteCode = (length = 8) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += alphabet[bytes[index] % alphabet.length];
  }

  return code;
};

const defaultPermissions = () => ({
  sendMedia: GROUP_PERMISSION_SCOPES.ALL,
  pinMessage: GROUP_PERMISSION_SCOPES.ALL,
  sendAnnouncement: GROUP_PERMISSION_SCOPES.ADMIN_DEPUTY
});

const defaultGroupSettings = () => ({
  invite: {
    code: generateInviteCode(),
    approvalRequired: true
  },
  joinRequests: [],
  permissions: defaultPermissions(),
  pinnedMessage: null
});

const normalizePermissionScope = (scope, fallbackScope) =>
  VALID_PERMISSION_SCOPES.includes(scope) ? scope : fallbackScope;

const normalizeGroupSettings = (groupSettings = {}) => {
  const defaults = defaultGroupSettings();

  return {
    invite: {
      code: groupSettings?.invite?.code || defaults.invite.code,
      approvalRequired:
        typeof groupSettings?.invite?.approvalRequired === "boolean"
          ? groupSettings.invite.approvalRequired
          : defaults.invite.approvalRequired
    },
    joinRequests: Array.isArray(groupSettings?.joinRequests)
      ? groupSettings.joinRequests
      : [],
    permissions: {
      sendMedia: normalizePermissionScope(
        groupSettings?.permissions?.sendMedia,
        defaults.permissions.sendMedia
      ),
      pinMessage: normalizePermissionScope(
        groupSettings?.permissions?.pinMessage,
        defaults.permissions.pinMessage
      ),
      sendAnnouncement: normalizePermissionScope(
        groupSettings?.permissions?.sendAnnouncement,
        defaults.permissions.sendAnnouncement
      )
    },
    pinnedMessage: groupSettings?.pinnedMessage || null
  };
};

const canUseScopedPermission = (participant, scope) => {
  const participantRank = ROLE_RANKS[participant.role] || 0;
  const requiredRank = PERMISSION_SCOPE_RANKS[scope] || Number.MAX_SAFE_INTEGER;
  return participantRank >= requiredRank;
};

const requireScopedPermission = (participant, scope, message) => {
  if (!canUseScopedPermission(participant, scope)) {
    throw createError(message, 403);
  }
};

const groupRoleLabel = (scope) => {
  if (scope === GROUP_PERMISSION_SCOPES.ADMIN) return "admin";
  if (scope === GROUP_PERMISSION_SCOPES.ADMIN_DEPUTY) return "admin or deputy";
  return "member";
};

const buildInviteUrl = (inviteCode) => {
  const baseUrl =
    process.env.WEB_INVITE_BASE_URL ||
    process.env.WEB_APP_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:5173";

  return `${String(baseUrl).replace(/\/$/, "")}/join-group?code=${encodeURIComponent(
    inviteCode
  )}`;
};

const sanitizeJoinRequests = (joinRequests = [], includeResolved = false) =>
  joinRequests.filter((request) =>
    includeResolved ? true : request.status === "pending"
  );

const GroupService = {
  async createGroup({ name, avatar, memberIds = [], createdBy }) {
    if (!createdBy) {
      throw createError("Unauthorized", 401);
    }

    if (!name || !String(name).trim()) {
      throw createError("Group name is required", 400);
    }

    const uniqueMemberIds = [...new Set(memberIds.filter((id) => id && id !== createdBy))];

    const participants = [
      createParticipant({ userId: createdBy, role: GROUP_ROLES.ADMIN }),
      ...uniqueMemberIds.map((id) =>
        createParticipant({ userId: id, role: GROUP_ROLES.MEMBER })
      )
    ];

    return GroupRepository.createGroup({
      type: "group",
      name,
      avatar,
      participants,
      createdBy,
      groupSettings: defaultGroupSettings()
    });
  },

  async getGroups(userId) {
    return GroupRepository.getGroupsByUserId(userId);
  },

  async getGroupSettings(id, { userId }) {
    const group = ensureGroup(await GroupRepository.getById(id));
    const currentUser = requireGroupMember(group, userId);
    
    let settings = group.groupSettings;
    if (!settings || !settings.invite || !settings.invite.code) {
      settings = normalizeGroupSettings(group.groupSettings);
      await GroupRepository.update(id, { groupSettings: settings });
    } else {
      settings = normalizeGroupSettings(group.groupSettings);
    }

    const canReviewRequests = [GROUP_ROLES.ADMIN, GROUP_ROLES.DEPUTY].includes(
      currentUser.role
    );

    return {
      groupId: id,
      invite: {
        code: settings.invite.code,
        approvalRequired: settings.invite.approvalRequired,
        inviteUrl: buildInviteUrl(settings.invite.code)
      },
      permissions: settings.permissions,
      pinnedMessage: settings.pinnedMessage,
      pendingJoinRequests: canReviewRequests
        ? sanitizeJoinRequests(settings.joinRequests, false)
        : [],
      canReviewRequests
    };
  },

  async rotateInviteCode(id, { userId }) {
    const group = ensureGroup(await GroupRepository.getById(id));
    const currentUser = requireGroupMember(group, userId);

    if (![GROUP_ROLES.ADMIN, GROUP_ROLES.DEPUTY].includes(currentUser.role)) {
      throw createError("Only admin or deputy can rotate invite code", 403);
    }

    const settings = normalizeGroupSettings(group.groupSettings);
    settings.invite.code = generateInviteCode();

    const updated = await GroupRepository.update(id, { groupSettings: settings });

    return {
      message: "Invite code rotated successfully",
      invite: {
        code: settings.invite.code,
        approvalRequired: settings.invite.approvalRequired,
        inviteUrl: buildInviteUrl(settings.invite.code)
      },
      group: updated
    };
  },

  async updateInviteSettings(id, { userId, approvalRequired }) {
    if (typeof approvalRequired !== "boolean") {
      throw createError("approvalRequired must be boolean", 400);
    }

    const group = ensureGroup(await GroupRepository.getById(id));
    const currentUser = requireGroupMember(group, userId);

    if (![GROUP_ROLES.ADMIN, GROUP_ROLES.DEPUTY].includes(currentUser.role)) {
      throw createError("Only admin or deputy can change invite settings", 403);
    }

    const settings = normalizeGroupSettings(group.groupSettings);
    settings.invite.approvalRequired = approvalRequired;

    const updated = await GroupRepository.update(id, { groupSettings: settings });

    return {
      message: "Invite settings updated",
      invite: {
        code: settings.invite.code,
        approvalRequired: settings.invite.approvalRequired,
        inviteUrl: buildInviteUrl(settings.invite.code)
      },
      group: updated
    };
  },

  async requestJoinByInviteCode({ inviteCode, userId }) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    if (!inviteCode || !String(inviteCode).trim()) {
      throw createError("inviteCode is required", 400);
    }

    const group = ensureGroup(await GroupRepository.findByInviteCode(String(inviteCode).trim()));

    if (findParticipant(group, userId)) {
      throw createError("You are already in this group", 400);
    }

    const settings = normalizeGroupSettings(group.groupSettings);

    if (!settings.invite.approvalRequired) {
      const newParticipant = createParticipant({
        userId,
        role: GROUP_ROLES.MEMBER
      });
      const updated = await GroupRepository.update(group._id, {
        participants: [...group.participants, newParticipant]
      });

      return {
        status: "joined",
        message: "Joined group successfully",
        group: updated
      };
    }

    const existingPendingRequest = settings.joinRequests.find(
      (request) => request.userId === userId && request.status === "pending"
    );

    if (existingPendingRequest) {
      return {
        status: "pending",
        message: "Your join request is already pending approval",
        requestId: existingPendingRequest.requestId,
        groupId: group._id,
        group
      };
    }

    const joinRequest = {
      requestId: crypto.randomUUID(),
      userId,
      requestedAt: new Date().toISOString(),
      status: "pending"
    };

    settings.joinRequests = [...settings.joinRequests, joinRequest];

    const updated = await GroupRepository.update(group._id, { groupSettings: settings });

    return {
      status: "requested",
      message: "Join request sent successfully",
      requestId: joinRequest.requestId,
      groupId: group._id,
      group: updated
    };
  },

  async getJoinRequests(id, { userId, includeResolved = false }) {
    const group = ensureGroup(await GroupRepository.getById(id));
    const currentUser = requireGroupMember(group, userId);

    if (![GROUP_ROLES.ADMIN, GROUP_ROLES.DEPUTY].includes(currentUser.role)) {
      throw createError("Only admin or deputy can review join requests", 403);
    }

    const settings = normalizeGroupSettings(group.groupSettings);

    return {
      groupId: id,
      totalRequests: settings.joinRequests.length,
      requests: sanitizeJoinRequests(settings.joinRequests, includeResolved)
    };
  },

  async reviewJoinRequest(id, { requestId, action, userId }) {
    if (!requestId) {
      throw createError("requestId is required", 400);
    }

    if (!["approve", "reject"].includes(action)) {
      throw createError("action must be approve or reject", 400);
    }

    const group = ensureGroup(await GroupRepository.getById(id));
    const currentUser = requireGroupMember(group, userId);

    if (![GROUP_ROLES.ADMIN, GROUP_ROLES.DEPUTY].includes(currentUser.role)) {
      throw createError("Only admin or deputy can review join requests", 403);
    }

    const settings = normalizeGroupSettings(group.groupSettings);
    const requestIndex = settings.joinRequests.findIndex(
      (request) => request.requestId === requestId
    );

    if (requestIndex === -1) {
      throw createError("Join request not found", 404);
    }

    if (settings.joinRequests[requestIndex].status !== "pending") {
      throw createError("Join request has already been reviewed", 400);
    }

    const request = settings.joinRequests[requestIndex];
    const reviewedRequest = {
      ...request,
      status: action === "approve" ? "approved" : "rejected",
      reviewedAt: new Date().toISOString(),
      reviewedBy: userId
    };

    settings.joinRequests[requestIndex] = reviewedRequest;

    let nextParticipants = group.participants;
    if (action === "approve" && !findParticipant(group, request.userId)) {
      nextParticipants = [
        ...group.participants,
        createParticipant({
          userId: request.userId,
          role: GROUP_ROLES.MEMBER
        })
      ];
    }

    const updated = await GroupRepository.update(id, {
      participants: nextParticipants,
      groupSettings: settings
    });

    return {
      message:
        action === "approve"
          ? "Join request approved successfully"
          : "Join request rejected successfully",
      request: reviewedRequest,
      group: updated
    };
  },

  async updateGroupPermissions(id, { userId, permissions = {} }) {
    const group = ensureGroup(await GroupRepository.getById(id));
    const currentUser = requireGroupMember(group, userId);
    requireAdmin(currentUser, "Only admin can update group permissions");

    const settings = normalizeGroupSettings(group.groupSettings);
    const nextPermissions = { ...settings.permissions };
    let hasChanges = false;

    ["sendMedia", "pinMessage", "sendAnnouncement"].forEach((key) => {
      if (permissions[key] !== undefined) {
        if (!VALID_PERMISSION_SCOPES.includes(permissions[key])) {
          throw createError(`Invalid permission scope for ${key}`, 400);
        }
        nextPermissions[key] = permissions[key];
        hasChanges = true;
      }
    });

    if (!hasChanges) {
      throw createError("No valid permission changes provided", 400);
    }

    settings.permissions = nextPermissions;

    const updated = await GroupRepository.update(id, { groupSettings: settings });

    return {
      message: "Group permissions updated successfully",
      permissions: nextPermissions,
      group: updated
    };
  },

  ensureCanSendMessage(group, { userId, type, metadata }) {
    if (!group || group.type !== "group") {
      return;
    }

    const participant = requireGroupMember(group, userId);
    const settings = normalizeGroupSettings(group.groupSettings);
    const isMediaMessage = ["image", "video", "file", "voice", "sticker"].includes(type);

    if (isMediaMessage) {
      const scope = settings.permissions.sendMedia;
      requireScopedPermission(
        participant,
        scope,
        `Only ${groupRoleLabel(scope)} can send media in this group`
      );
    }

    if (metadata?.isAnnouncement) {
      const scope = settings.permissions.sendAnnouncement;
      requireScopedPermission(
        participant,
        scope,
        `Only ${groupRoleLabel(scope)} can send announcements in this group`
      );
    }
  },

  async pinMessage(id, { messageId, userId }) {
    if (!messageId) {
      throw createError("messageId is required", 400);
    }

    const group = ensureGroup(await GroupRepository.getById(id));
    const participant = requireGroupMember(group, userId);
    const settings = normalizeGroupSettings(group.groupSettings);
    const pinScope = settings.permissions.pinMessage;

    requireScopedPermission(
      participant,
      pinScope,
      `Only ${groupRoleLabel(pinScope)} can pin messages in this group`
    );

    const message = await GroupRepository.getMessageById(messageId);
    if (!message || message.conversationId !== id) {
      throw createError("Message not found in this group", 404);
    }

    if (message.isDeleted) {
      throw createError("Cannot pin a deleted message", 400);
    }

    settings.pinnedMessage = {
      messageId: message._id,
      senderId: message.senderId,
      type: message.type,
      content: message.content,
      metadata: message.metadata || null,
      pinnedAt: new Date().toISOString(),
      pinnedBy: userId
    };

    const updated = await GroupRepository.update(id, { groupSettings: settings });

    return {
      message: "Message pinned successfully",
      pinnedMessage: settings.pinnedMessage,
      group: updated
    };
  },

  async unpinMessage(id, { userId }) {
    const group = ensureGroup(await GroupRepository.getById(id));
    const participant = requireGroupMember(group, userId);
    const settings = normalizeGroupSettings(group.groupSettings);
    const pinScope = settings.permissions.pinMessage;

    requireScopedPermission(
      participant,
      pinScope,
      `Only ${groupRoleLabel(pinScope)} can unpin messages in this group`
    );

    settings.pinnedMessage = null;

    const updated = await GroupRepository.update(id, { groupSettings: settings });

    return {
      message: "Pinned message cleared",
      group: updated
    };
  },

  async renameGroup(id, { name, userId }) {
    const group = ensureGroup(await GroupRepository.getById(id));
    requireGroupMember(group, userId);

    if (!name || !String(name).trim()) {
      throw createError("Group name is required", 400);
    }

    return GroupRepository.update(id, { name });
  },

  async updateAvatar(id, { avatar, userId }) {
    const group = ensureGroup(await GroupRepository.getById(id));
    requireGroupMember(group, userId);

    return GroupRepository.update(id, { avatar });
  },

  async addMember(id, { newUserId, userId }) {
    if (!newUserId) {
      throw createError("newUserId is required", 400);
    }

    const group = ensureGroup(await GroupRepository.getById(id));
    requireGroupMember(group, userId);

    if (newUserId === userId) {
      throw createError("User already in group", 400);
    }

    if (findParticipant(group, newUserId)) {
      throw createError("User already in group", 400);
    }

    const newParticipant = createParticipant({
      userId: newUserId,
      role: GROUP_ROLES.MEMBER
    });
    const settings = normalizeGroupSettings(group.groupSettings);
    settings.joinRequests = settings.joinRequests.map((request) =>
      request.userId === newUserId && request.status === "pending"
        ? {
            ...request,
            status: "approved",
            reviewedAt: new Date().toISOString(),
            reviewedBy: userId
          }
        : request
    );

    return GroupRepository.update(id, {
      participants: [...group.participants, newParticipant],
      groupSettings: settings
    });
  },

  async removeMember(id, { removeUserId, userId }) {
    if (!userId || !removeUserId) {
      throw createError("userId and removeUserId are required", 400);
    }

    const group = ensureGroup(await GroupRepository.getById(id));
    const currentUser = requireGroupMember(group, userId);

    if (![GROUP_ROLES.ADMIN, GROUP_ROLES.DEPUTY].includes(currentUser.role)) {
      throw createError("Only admin or deputy can remove members", 403);
    }

    const memberToRemove = findParticipant(group, removeUserId);
    if (!memberToRemove) {
      throw createError("User not found in group", 404);
    }

    if (userId === removeUserId) {
      throw createError("You cannot remove yourself from the group", 400);
    }

    if (
      currentUser.role === GROUP_ROLES.DEPUTY &&
      memberToRemove.role !== GROUP_ROLES.MEMBER
    ) {
      throw createError("Deputy can only remove members", 403);
    }

    const updatedParticipants = group.participants.filter(
      (participant) => participant.userId !== removeUserId
    );

    const updated = await GroupRepository.update(id, {
      participants: updatedParticipants
    });

    return {
      message: "Member removed successfully",
      group: updated
    };
  },

  async transferAdmin(id, { newAdminUserId, userId }) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    if (!newAdminUserId) {
      throw createError("newAdminUserId is required", 400);
    }

    const group = ensureGroup(await GroupRepository.getById(id));
    const currentUser = requireGroupMember(group, userId);
    requireAdmin(currentUser, "Only admin can transfer admin role");

    if (newAdminUserId === userId) {
      throw createError("You are already the admin", 400);
    }

    const nextAdmin = findParticipant(group, newAdminUserId);
    if (!nextAdmin) {
      throw createError("Target user is not in this group", 404);
    }

    const participantsAfterDemote = updateParticipantRole(
      group.participants,
      userId,
      GROUP_ROLES.MEMBER
    );
    const updatedParticipants = updateParticipantRole(
      participantsAfterDemote,
      newAdminUserId,
      GROUP_ROLES.ADMIN
    );

    const updated = await GroupRepository.update(id, {
      participants: updatedParticipants
    });

    return {
      message: "Admin role transferred successfully",
      group: updated
    };
  },

  async appointDeputy(id, { deputyUserId, userId }) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    if (!deputyUserId) {
      throw createError("deputyUserId is required", 400);
    }

    const group = ensureGroup(await GroupRepository.getById(id));
    const currentUser = requireGroupMember(group, userId);
    requireAdmin(currentUser, "Only admin can appoint deputy");

    if (deputyUserId === userId) {
      throw createError("Admin already has higher privileges than deputy", 400);
    }

    const targetMember = findParticipant(group, deputyUserId);
    if (!targetMember) {
      throw createError("Target user is not in this group", 404);
    }

    if (targetMember.role === GROUP_ROLES.DEPUTY) {
      throw createError("User is already a deputy", 400);
    }

    if (targetMember.role === GROUP_ROLES.ADMIN) {
      throw createError("User is already the admin", 400);
    }

    const updatedParticipants = updateParticipantRole(
      group.participants,
      deputyUserId,
      GROUP_ROLES.DEPUTY
    );

    const updated = await GroupRepository.update(id, {
      participants: updatedParticipants
    });

    return {
      message: "Deputy role assigned successfully",
      group: updated
    };
  },

  async revokeDeputy(id, { deputyUserId, userId }) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    if (!deputyUserId) {
      throw createError("deputyUserId is required", 400);
    }

    const group = ensureGroup(await GroupRepository.getById(id));
    const currentUser = requireGroupMember(group, userId);
    requireAdmin(currentUser, "Only admin can revoke deputy role");

    if (deputyUserId === userId) {
      throw createError("Admin is not a deputy", 400);
    }

    const targetMember = findParticipant(group, deputyUserId);
    if (!targetMember) {
      throw createError("Target user is not in this group", 404);
    }

    if (targetMember.role !== GROUP_ROLES.DEPUTY) {
      throw createError("User is not a deputy", 400);
    }

    const updatedParticipants = updateParticipantRole(
      group.participants,
      deputyUserId,
      GROUP_ROLES.MEMBER
    );

    const updated = await GroupRepository.update(id, {
      participants: updatedParticipants
    });

    return {
      message: "Deputy role revoked successfully",
      group: updated
    };
  },

  async getGroupMembers(id, { role, userId }) {
    const group = ensureGroup(await GroupRepository.getById(id));
    requireGroupMember(group, userId);

    if (role && !VALID_GROUP_ROLES.includes(role)) {
      throw createError("Invalid role filter", 400);
    }

    const members = role
      ? group.participants.filter((participant) => participant.role === role)
      : group.participants;

    return {
      groupId: id,
      filterRole: role || null,
      totalMembers: group.participants.length,
      returnedMembers: members.length,
      roleSummary: buildRoleSummary(group.participants),
      members
    };
  },

  async leaveGroup(id, { userId, newAdminUserId }) {
    if (!userId) {
      throw createError("userId is required", 400);
    }

    const group = ensureGroup(await GroupRepository.getById(id));
    const member = requireGroupMember(group, userId);

    if (group.participants.length === 1) {
      throw createError("Cannot leave group because you are the last member", 400);
    }

    let updatedParticipants = group.participants.filter(
      (participant) => participant.userId !== userId
    );
    let transferredAdminTo = null;

    if (member.role === GROUP_ROLES.ADMIN) {
      if (!newAdminUserId) {
        throw createError("Admin must choose a new admin before leaving the group", 400);
      }

      if (String(newAdminUserId) === String(userId)) {
        throw createError("New admin must be another group member", 400);
      }

      const nextAdmin = findParticipant(group, newAdminUserId);
      if (!nextAdmin) {
        throw createError("Target user is not in this group", 404);
      }

      updatedParticipants = updateParticipantRole(
        updatedParticipants,
        newAdminUserId,
        GROUP_ROLES.ADMIN
      );
      transferredAdminTo = String(newAdminUserId);
    }

    const updated = await GroupRepository.update(id, {
      participants: updatedParticipants
    });

    return {
      message: "You left the group successfully",
      group: updated,
      transferredAdminTo
    };
  },

  async dissolveGroup(id, { userId }) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const group = ensureGroup(await GroupRepository.getById(id));
    const currentUser = requireGroupMember(group, userId);
    requireAdmin(currentUser, "Only admin can dissolve the group");

    const { deletedCount } = await GroupRepository.deleteMessagesByConversationId(id);
    await GroupRepository.deleteById(id);

    return {
      message: "Group dissolved successfully",
      groupId: id,
      deletedMessages: deletedCount
    };
  }
};

module.exports = GroupService;
