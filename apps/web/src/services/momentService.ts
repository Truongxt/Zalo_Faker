import { baseAPI, fetchWithAuth } from './api';
import type { Moment, MomentComment, MomentProfile } from '../types/moment';

export interface MomentImageFile {
  file: File;
}

export interface CreateMomentPayload {
  content?: string;
  mediaUrls?: string[];
  imageFile?: MomentImageFile | null;
}

class MomentService {
  async createMoment(payload: CreateMomentPayload): Promise<Moment> {
    const { content = "", mediaUrls = [], imageFile } = payload;

    if (imageFile?.file) {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("mediaUrls", JSON.stringify(mediaUrls));
      formData.append("image", imageFile.file);

      const response = await fetchWithAuth(`/moments`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Thêm bài viết thất bại");
      return response.json();
    }

    const response = await fetchWithAuth(`${baseAPI}/moments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        mediaUrls,
      }),
    });

    if (!response.ok) throw new Error("Thêm bài viết thất bại");
    return response.json();
  }

  async getFriendMoments(): Promise<Moment[]> {
    const response = await fetchWithAuth(`/moments/friends`);
    if (!response.ok) throw new Error("Lấy danh sách bài viết thất bại");
    return response.json();
  }

  async getMyProfile(): Promise<MomentProfile> {
    const response = await fetchWithAuth(`/moments/me`);
    if (!response.ok) throw new Error("Lấy hồ sơ cá nhân thất bại");
    return response.json();
  }

  async getReactedMoments(): Promise<Moment[]> {
    const response = await fetchWithAuth(`/moments/reacted`);
    if (!response.ok) throw new Error("Lấy danh sách bài viết đã phản hồi thất bại");
    return response.json();
  }

  async reactToMoment(momentId: string, emoji: string) {
    const response = await fetchWithAuth(`/moments/${momentId}/reaction`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emoji }),
    });
    if (!response.ok) throw new Error("Thả cảm xúc thất bại");
    return response.json();
  }

  async getMomentComments(momentId: string): Promise<MomentComment[]> {
    const response = await fetchWithAuth(`/moments/${momentId}/comments`);
    if (!response.ok) throw new Error("Lấy bình luận thất bại");
    return response.json();
  }

  async commentMoment(momentId: string, content: string): Promise<MomentComment> {
    return this.replyToComment(momentId, content, null);
  }

  async replyToComment(
    momentId: string,
    content: string,
    replyToCommentId: string | null,
  ): Promise<MomentComment> {
    const response = await fetchWithAuth(`/moments/${momentId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, replyToCommentId }),
    });
    if (!response.ok) throw new Error("Thêm bình luận thất bại");
    return response.json();
  }

  async reactToComment(momentId: string, commentId: string, emoji: string) {
    const response = await fetchWithAuth(`/moments/${momentId}/comments/${commentId}/reaction`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emoji }),
    });
    if (!response.ok) throw new Error("Thả cảm xúc bình luận thất bại");
    return response.json();
  }

  async shareMoment(momentId: string, caption = ""): Promise<Moment> {
    const response = await fetchWithAuth(`/moments/${momentId}/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ caption }),
    });
    if (!response.ok) throw new Error("Chia sẻ thất bại");
    return response.json();
  }

  async deleteMoment(momentId: string): Promise<{ message: string; momentId: string }> {
    const response = await fetchWithAuth(`/moments/${momentId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Xoá bài viết thất bại");
    return response.json();
  }
}

export const momentService = new MomentService();
