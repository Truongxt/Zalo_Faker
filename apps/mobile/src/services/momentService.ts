import apiClient from "./apiClient";
import type { Moment, MomentComment, MomentProfile } from "@/types";

export interface MomentImageFile {
  uri: string;
  name?: string;
  mimeType?: string | null;
}

export interface CreateMomentPayload {
  content?: string;
  mediaUrls?: string[];
  imageFile?: MomentImageFile | null;
}

class MomentService {
  async createMoment(payload: CreateMomentPayload): Promise<Moment> {
    const { content = "", mediaUrls = [], imageFile } = payload;

    if (imageFile?.uri) {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("mediaUrls", JSON.stringify(mediaUrls));
      formData.append("image", {
        uri: imageFile.uri,
        name: imageFile.name || `moment-${Date.now()}.jpg`,
        type: imageFile.mimeType || "image/jpeg",
      } as any);

      const response = await apiClient.post<Moment>("/api/moments", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    }

    const response = await apiClient.post<Moment>("/api/moments", {
      content,
      mediaUrls,
    });

    return response.data;
  }

  async getFriendMoments(): Promise<Moment[]> {
    const response = await apiClient.get<Moment[]>("/api/moments/friends");
    return response.data;
  }

  async getMyProfile(): Promise<MomentProfile> {
    const response = await apiClient.get<MomentProfile>("/api/moments/me");
    return response.data;
  }

  async getReactedMoments(): Promise<Moment[]> {
    const response = await apiClient.get<Moment[]>("/api/moments/reacted");
    return response.data;
  }

  async reactToMoment(momentId: string, emoji: string) {
    const response = await apiClient.put(`/api/moments/${momentId}/reaction`, {
      emoji,
    });

    return response.data;
  }

  async getMomentComments(momentId: string): Promise<MomentComment[]> {
    const response = await apiClient.get<MomentComment[]>(
      `/api/moments/${momentId}/comments`,
    );
    return response.data;
  }

  async commentMoment(momentId: string, content: string): Promise<MomentComment> {
    return this.replyToComment(momentId, content, null);
  }

  async replyToComment(
    momentId: string,
    content: string,
    replyToCommentId: string | null,
  ): Promise<MomentComment> {
    const response = await apiClient.post<MomentComment>(
      `/api/moments/${momentId}/comments`,
      { content, replyToCommentId },
    );

    return response.data;
  }

  async reactToComment(momentId: string, commentId: string, emoji: string) {
    const response = await apiClient.put<MomentComment>(
      `/api/moments/${momentId}/comments/${commentId}/reaction`,
      { emoji },
    );

    return response.data;
  }

  async shareMoment(momentId: string, caption = ""): Promise<Moment> {
    const response = await apiClient.post<Moment>(`/api/moments/${momentId}/share`, {
      caption,
    });

    return response.data;
  }

  async deleteMoment(momentId: string): Promise<{ message: string; momentId: string }> {
    const response = await apiClient.delete<{ message: string; momentId: string }>(
      `/api/moments/${momentId}`,
    );

    return response.data;
  }
}

export const momentService = new MomentService();
