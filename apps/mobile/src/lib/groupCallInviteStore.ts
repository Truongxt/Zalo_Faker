export type GroupCallInvite = {
  conversationId: string;
  roomId: string;
  callType: "audio" | "video";
  hostUserId?: string;
  callerName?: string;
  callerAvatar?: string | null;
  updatedAt: number;
};

const TTL_MS = 15 * 60 * 1000;
const invitesByConversationId = new Map<string, GroupCallInvite>();

const normalizeConversationId = (conversationId: string): string =>
  String(conversationId || "").trim();

export const groupCallInviteStore = {
  set(invite: GroupCallInvite) {
    const key = normalizeConversationId(invite.conversationId);
    if (!key || !invite.roomId) return;
    invitesByConversationId.set(key, {
      ...invite,
      conversationId: key,
      updatedAt: Date.now(),
    });
  },

  get(conversationId: string): GroupCallInvite | null {
    const key = normalizeConversationId(conversationId);
    if (!key) return null;
    const invite = invitesByConversationId.get(key);
    if (!invite) return null;

    if (Date.now() - invite.updatedAt > TTL_MS) {
      invitesByConversationId.delete(key);
      return null;
    }
    return invite;
  },

  remove(conversationId: string) {
    const key = normalizeConversationId(conversationId);
    if (!key) return;
    invitesByConversationId.delete(key);
  },
};

