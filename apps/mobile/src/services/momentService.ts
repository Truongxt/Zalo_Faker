import { apiFetch } from "./fetchClient";
import type { Moment, MomentComment, MomentProfile } from "@/types";

export interface MomentMediaFile {
  uri: string;
  name?: string;
  mimeType?: string | null;
}

const getMomentMimeType = (file: MomentMediaFile) => {
  if (file.mimeType) {
    return file.mimeType;
  }

  const normalizedName = String(file.name || file.uri || "").toLowerCase();

  if (normalizedName.endsWith(".png")) return "image/png";
  if (normalizedName.endsWith(".gif")) return "image/gif";
  if (normalizedName.endsWith(".webp")) return "image/webp";
  if (normalizedName.endsWith(".heic")) return "image/heic";
  if (normalizedName.endsWith(".heif")) return "image/heif";
  if (normalizedName.endsWith(".mov")) return "video/quicktime";
  if (normalizedName.endsWith(".webm")) return "video/webm";
  if (normalizedName.endsWith(".mp4")) return "video/mp4";

  return "image/jpeg";
};

export interface CreateMomentPayload {
  content?: string;
  mediaUrls?: string[];
  mediaFiles?: MomentMediaFile[];
}

class MomentService {
  async createMoment(payload: CreateMomentPayload): Promise<Moment> {
    const { content = "", mediaUrls = [], mediaFiles = [] } = payload;

    if (mediaFiles.length > 0) {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("mediaUrls", JSON.stringify(mediaUrls));
      mediaFiles.forEach((mediaFile, index) => {
        const mimeType = getMomentMimeType(mediaFile);
        const fallbackExtension = mimeType.startsWith("video/") ? "mp4" : "jpg";
        formData.append("files", {
          uri: mediaFile.uri,
          name: mediaFile.name || `moment-${Date.now()}-${index}.${fallbackExtension}`,
          type: mimeType,
        } as any);
      });

      return apiFetch<Moment>("/api/moments", {
        method: "POST",
        body: formData,
      });
    }

    return apiFetch<Moment>("/api/moments", {
      method: "POST",
      body: {
        content,
        mediaUrls,
      },
    });
  }

  async getFriendMoments(): Promise<Moment[]> {
    return apiFetch<Moment[]>("/api/moments/friends");
  }

  async getMyProfile(): Promise<MomentProfile> {
    return apiFetch<MomentProfile>("/api/moments/me");
  }

  async getReactedMoments(): Promise<Moment[]> {
    return apiFetch<Moment[]>("/api/moments/reacted");
  }

  async reactToMoment(momentId: string, emoji: string) {
    return apiFetch(`/api/moments/${momentId}/reaction`, {
      method: "PUT",
      body: { emoji },
    });
  }

  async getMomentComments(momentId: string): Promise<MomentComment[]> {
    return apiFetch<MomentComment[]>(`/api/moments/${momentId}/comments`);
  }

  async commentMoment(momentId: string, content: string): Promise<MomentComment> {
    return this.replyToComment(momentId, content, null);
  }

  async replyToComment(
    momentId: string,
    content: string,
    replyToCommentId: string | null,
  ): Promise<MomentComment> {
    return apiFetch<MomentComment>(`/api/moments/${momentId}/comments`, {
      method: "POST",
      body: { content, replyToCommentId },
    });
  }

  async reactToComment(momentId: string, commentId: string, emoji: string) {
    return apiFetch<MomentComment>(`/api/moments/${momentId}/comments/${commentId}/reaction`, {
      method: "PUT",
      body: { emoji },
    });
  }

  async shareMoment(momentId: string, caption = ""): Promise<Moment> {
    return apiFetch<Moment>(`/api/moments/${momentId}/share`, {
      method: "POST",
      body: { caption },
    });
  }

  async deleteMoment(momentId: string): Promise<{ message: string; momentId: string }> {
    return apiFetch<{ message: string; momentId: string }>(`/api/moments/${momentId}`, {
      method: "DELETE",
    });
  }
}

export const momentService = new MomentService();
