import type { GroupPermissionScope, User } from "@/types";
import { apiFetch } from "./fetchClient";
import { userService } from "./userService";

export interface GroupAvatarFile {
  uri: string;
  name?: string;
  mimeType?: string | null;
}

export interface CreateGroupPayload {
  name: string;
  avatar?: string;
  memberIds: string[];
  avatarFile?: GroupAvatarFile | null;
}

export interface GroupInviteSettings {
  code: string;
  approvalRequired: boolean;
  inviteUrl?: string;
}

export interface GroupPermissionSettings {
  sendMedia: GroupPermissionScope;
  pinMessage: GroupPermissionScope;
  sendAnnouncement: GroupPermissionScope;
}

export interface GroupJoinRequest {
  requestId: string;
  userId: string;
  requestedAt: string;
  status?: "pending" | "approved" | "rejected";
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface GroupSettingsResponse {
  groupId: string;
  invite: GroupInviteSettings;
  permissions: GroupPermissionSettings;
  pinnedMessage: any;
  pendingJoinRequests: GroupJoinRequest[];
  canReviewRequests: boolean;
}

export const getGroups = async () => apiFetch<any[]>("/api/groups");

export const getGroupById = async (groupId: string) => {
  const groups = await getGroups();
  return (
    groups.find(
      (group) => String(group._id || group.id || "") === String(groupId),
    ) || null
  );
};

export const getUsers = async (): Promise<User[]> => userService.getUsers();

export const createGroup = async (data: CreateGroupPayload) => {
  const { avatarFile, memberIds, ...rest } = data;

  if (avatarFile?.uri) {
    const formData = new FormData();
    formData.append("name", rest.name);
    formData.append("avatar", rest.avatar || "");
    formData.append("memberIds", JSON.stringify(memberIds));
    formData.append("image", {
      uri: avatarFile.uri,
      name: avatarFile.name || `group-avatar-${Date.now()}.jpg`,
      type: avatarFile.mimeType || "image/jpeg",
    } as any);

    return apiFetch("/api/groups", {
      method: "POST",
      body: formData,
    });
  }

  return apiFetch("/api/groups", {
    method: "POST",
    body: {
      ...rest,
      memberIds,
    },
  });
};

export const getGroupSettings = async (groupId: string) =>
  apiFetch<GroupSettingsResponse>(`/api/groups/${groupId}/settings`);

export const rotateGroupInviteCode = async (groupId: string) =>
  apiFetch<{
    message: string;
    invite: GroupInviteSettings;
    group: any;
  }>(`/api/groups/${groupId}/invite/rotate`, {
    method: "POST",
  });

export const updateGroupInviteSettings = async (
  groupId: string,
  payload: { approvalRequired: boolean },
) =>
  apiFetch<{
    message: string;
    invite: GroupInviteSettings;
    group: any;
  }>(`/api/groups/${groupId}/settings/invite`, {
    method: "PATCH",
    body: payload,
  });

export const getGroupJoinRequests = async (
  groupId: string,
  includeResolved = false,
) =>
  apiFetch<{
    groupId: string;
    totalRequests: number;
    requests: GroupJoinRequest[];
  }>(
    `/api/groups/${groupId}/join-requests${includeResolved ? "?includeResolved=true" : ""}`,
  );

export const reviewGroupJoinRequest = async (
  groupId: string,
  requestId: string,
  action: "approve" | "reject",
) =>
  apiFetch<{
    message: string;
    request: GroupJoinRequest;
    group: any;
  }>(`/api/groups/${groupId}/join-requests/${requestId}/review`, {
    method: "POST",
    body: { action },
  });

export const updateGroupPermissions = async (
  groupId: string,
  permissions: Partial<GroupPermissionSettings>,
) =>
  apiFetch<{
    message: string;
    permissions: GroupPermissionSettings;
    group: any;
  }>(`/api/groups/${groupId}/settings/permissions`, {
    method: "PATCH",
    body: permissions,
  });

export const pinGroupMessage = async (groupId: string, messageId: string) => {
  return apiFetch(`/api/groups/${groupId}/pin-message`, {
    method: "PUT",
    body: { messageId },
  });
};

export const unpinGroupMessage = async (groupId: string) => {
  return apiFetch(`/api/groups/${groupId}/pin-message`, {
    method: "DELETE",
  });
};

export const addGroupMember = async (
  groupId: string,
  payload: { userId?: string; newUserId: string },
) =>
  apiFetch<any>(`/api/groups/${groupId}/add-member`, {
    method: "PUT",
    body: payload,
  });

export const removeGroupMember = async (
  groupId: string,
  payload: { userId?: string; removeUserId: string },
) =>
  apiFetch<{
    message: string;
    group: any;
  }>(`/api/groups/${groupId}/remove-member`, {
    method: "PUT",
    body: payload,
  });

export const leaveGroup = async (
  groupId: string,
  payload: { userId?: string; newAdminUserId?: string },
) =>
  apiFetch<{
    message: string;
    group: any;
    transferredAdminTo?: string | null;
  }>(`/api/groups/${groupId}/leave`, {
    method: "PUT",
    body: payload,
  });

export const transferAdmin = async (
  groupId: string,
  payload: { userId?: string; newAdminUserId: string },
) =>
  apiFetch<{
    message: string;
    group: any;
  }>(`/api/groups/${groupId}/transfer-admin`, {
    method: "PUT",
    body: payload,
  });

export const appointDeputy = async (
  groupId: string,
  payload: { userId?: string; deputyUserId: string },
) =>
  apiFetch<{
    message: string;
    group: any;
  }>(`/api/groups/${groupId}/appoint-deputy`, {
    method: "PUT",
    body: payload,
  });

export const revokeDeputy = async (
  groupId: string,
  payload: { userId?: string; deputyUserId: string },
) =>
  apiFetch<{
    message: string;
    group: any;
  }>(`/api/groups/${groupId}/revoke-deputy`, {
    method: "PUT",
    body: payload,
  });

export const dissolveGroup = async (
  groupId: string,
  payload?: { userId?: string },
) =>
  apiFetch<{
    message: string;
    groupId: string;
    deletedMessages: number;
  }>(`/api/groups/${groupId}`, {
    method: "DELETE",
    body: payload,
  });

export const renameGroup = async (groupId: string, name: string) =>
  apiFetch<{
    message: string;
    group: any;
  }>(`/api/groups/${groupId}/rename`, {
    method: "PUT",
    body: { name },
  });

export const updateGroupAvatar = async (groupId: string, avatar: string) =>
  apiFetch<{
    message: string;
    group: any;
  }>(`/api/groups/${groupId}/avatar`, {
    method: "PUT",
    body: { avatar },
  });
