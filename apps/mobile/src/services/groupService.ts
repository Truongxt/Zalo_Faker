import apiClient from "./apiClient";

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

    const res = await apiClient.post("/api/groups", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data;
  }

  const res = await apiClient.post("/api/groups", {
    ...rest,
    memberIds,
  });

  return res.data;
};
