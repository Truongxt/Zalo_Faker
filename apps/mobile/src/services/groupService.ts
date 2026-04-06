import { apiFetch } from "./fetchClient";

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

export const getGroups = async () => apiFetch<any[]>("/api/groups");

export const getGroupById = async (groupId: string) => {
  const groups = await getGroups();
  return groups.find((group) => group._id === groupId) || null;
};

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
