import { fetchWithAuth } from './api';
import type { Moment, MomentComment, MomentProfile } from '../types/moment';

export interface MomentMediaFile {
  file: File;
}

export interface CreateMomentPayload {
  content?: string;
  mediaUrls?: string[];
  mediaFiles?: MomentMediaFile[];
}

export interface UpdateMomentPayload {
  content?: string;
  retainMediaUrls?: string[];
  mediaFiles?: MomentMediaFile[];
}

class MomentService {
  async createMoment(payload: CreateMomentPayload): Promise<Moment> {
    const { content = '', mediaUrls = [], mediaFiles = [] } = payload;

    if (mediaFiles.length > 0) {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('mediaUrls', JSON.stringify(mediaUrls));
      mediaFiles.forEach((mediaFile) => {
        formData.append('files', mediaFile.file);
      });

      const response = await fetchWithAuth('/moments', {
        method: 'POST',
        body: formData,
      });

      return response.json();
    }

    const response = await fetchWithAuth('/moments', {
      method: 'POST',
      body: JSON.stringify({
        content,
        mediaUrls,
      }),
    });

    return response.json();
  }

  async updateMoment(momentId: string, payload: UpdateMomentPayload): Promise<Moment> {
    const { content = '', retainMediaUrls = [], mediaFiles = [] } = payload;

    if (mediaFiles.length > 0) {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('retainMediaUrls', JSON.stringify(retainMediaUrls));
      mediaFiles.forEach((mediaFile) => {
        formData.append('files', mediaFile.file);
      });

      const response = await fetchWithAuth(`/moments/${momentId}`, {
        method: 'PUT',
        body: formData,
      });

      return response.json();
    }

    const response = await fetchWithAuth(`/moments/${momentId}`, {
      method: 'PUT',
      body: JSON.stringify({
        content,
        retainMediaUrls,
      }),
    });

    return response.json();
  }

  async getFriendMoments(): Promise<Moment[]> {
    const response = await fetchWithAuth('/moments/friends');
    return response.json();
  }

  async getMyProfile(): Promise<MomentProfile> {
    const response = await fetchWithAuth('/moments/me');
    return response.json();
  }

  async getReactedMoments(): Promise<Moment[]> {
    const response = await fetchWithAuth('/moments/reacted');
    return response.json();
  }

  async reactToMoment(momentId: string, emoji: string) {
    const response = await fetchWithAuth(`/moments/${momentId}/reaction`, {
      method: 'PUT',
      body: JSON.stringify({ emoji }),
    });
    return response.json();
  }

  async getMomentComments(momentId: string): Promise<MomentComment[]> {
    const response = await fetchWithAuth(`/moments/${momentId}/comments`);
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
      method: 'POST',
      body: JSON.stringify({ content, replyToCommentId }),
    });
    return response.json();
  }

  async reactToComment(momentId: string, commentId: string, emoji: string) {
    const response = await fetchWithAuth(
      `/moments/${momentId}/comments/${commentId}/reaction`,
      {
        method: 'PUT',
        body: JSON.stringify({ emoji }),
      },
    );
    return response.json();
  }

  async deleteComment(
    momentId: string,
    commentId: string,
  ): Promise<{ message: string; momentId: string; commentId: string }> {
    const response = await fetchWithAuth(`/moments/${momentId}/comments/${commentId}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  async shareMoment(momentId: string, caption = ''): Promise<Moment> {
    const response = await fetchWithAuth(`/moments/${momentId}/share`, {
      method: 'POST',
      body: JSON.stringify({ caption }),
    });
    return response.json();
  }

  async deleteMoment(momentId: string): Promise<{ message: string; momentId: string }> {
    const response = await fetchWithAuth(`/moments/${momentId}`, {
      method: 'DELETE',
    });
    return response.json();
  }
}

export const momentService = new MomentService();
