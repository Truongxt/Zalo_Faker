const { createParticipant } = require("../models/participant.js");
const GroupRepository = require("../repository/groupRepository");

const GROUP_ROLES = {
  ADMIN: "admin",
  DEPUTY: "deputy",
  MEMBER: "member"
};

const VALID_GROUP_ROLES = Object.values(GROUP_ROLES);

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
      createdBy
    });
  },

  async getGroups(userId) {
    return GroupRepository.getGroupsByUserId(userId);
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

    return GroupRepository.update(id, {
      participants: [...group.participants, newParticipant]
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

  async leaveGroup(id, { userId }) {
    if (!userId) {
      throw createError("userId is required", 400);
    }

    const group = ensureGroup(await GroupRepository.getById(id));
    const member = requireGroupMember(group, userId);

    if (group.participants.length === 1) {
      throw createError("Cannot leave group because you are the last member", 400);
    }

    if (member.role === GROUP_ROLES.ADMIN) {
      throw createError("Admin must transfer admin role before leaving the group", 400);
    }

    const updatedParticipants = group.participants.filter(
      (participant) => participant.userId !== userId
    );

    const updated = await GroupRepository.update(id, {
      participants: updatedParticipants
    });

    return {
      message: "You left the group successfully",
      group: updated
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
