import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  FormEvent,
  ChangeEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useChatStore,
  type Message,
  type GroupPermissionScope,
  normalizeMessage,
} from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/contexts/ToastContext";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useDebounce } from "@/hooks/useDebounce";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useMessagePagination } from "@/hooks/useMessagePagination";
import {
  Send,
  Image,
  Paperclip,
  Smile as SmileIcon,
  Phone,
  Video,
  MoreVertical,
  Mic,
  Square,
  X,
  Reply,
  ArrowLeft,
  Sticker,
  Search,
  Loader,
  WifiOff,
  Megaphone,
  Pin,
  Info,
  Clock3,
  Users,
  FileText,
  Link2,
  ChevronDown,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import MessageBubble from "@/components/chat/MessageBubble";
import PinHistoryBanner from "@/components/chat/PinHistoryBanner";
import TypingIndicator from "@/components/chat/TypingIndicator";
import StickerPicker from "@/components/chat/StickerPicker";
import VirtualizedMessageList from "@/components/chat/VirtualizedMessageList";
import {
  getMessages,
  getConversation,
  getGroupSettings,
  getDailyConversationSummary,
  pinGroupMessage,
  pinConversationMessage,
  unpinGroupMessage,
  unpinConversationMessage,
} from "@/services/api";
import { socketService } from "@/lib/socket";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import {
  deleteChatHistory,
  updateParticipantSetting,
  updateConversationBackground,
  uploadMedia,
  sendMessage as sendMessageApi,
  votePoll,
  addPollOption,
  removePollOption,
} from "@/services/api";
import GroupManagementModal from "@/components/chat/GroupManagementModal";
import ForwardMessageModal from "@/components/chat/ForwardMessageModal";
import BackgroundPickerModal from "@/components/chat/BackgroundPickerModal";
import PollComposerModal from "@/components/chat/PollComposerModal";
import { useCallStore } from "@/stores/callStore";
import { friendsService } from "@/services/friendsService";
import {
  appendPinHistoryEntry,
  isPinHistoryMessage,
  loadPinHistoryEntries,
  mergeMessagesWithPinHistory,
  type PinHistoryEntry,
} from "@/lib/pinHistory";

type InfoPanelSectionKey = "media" | "files" | "links";

type SharedMediaItem = {
  id: string;
  url: string;
  type: "image" | "video";
  createdAt: string;
  senderName: string;
};

type SharedFileItem = {
  id: string;
  name: string;
  url?: string;
  size?: number;
  createdAt: string;
  senderName: string;
};

type SharedLinkItem = {
  id: string;
  url: string;
  host: string;
  createdAt: string;
  senderName: string;
};

const trimTrailingPunctuation = (value: string) =>
  value.replace(/[),.!?]+$/, "");

const parseFileNameFromUrl = (url?: string) => {
  if (!url) return "Tệp đính kèm";
  const cleanUrl = String(url).split("?")[0];
  const lastSegment = cleanUrl.split("/").pop();
  if (!lastSegment) return "Tệp đính kèm";
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
};

const getUrlHost = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const formatPanelDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--/--/----";
  return date.toLocaleDateString("vi-VN");
};

const formatPanelFileSize = (size?: number) => {
  if (!size || size <= 0) return "";
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(size / 1024).toFixed(0)} KB`;
};

const isImageBackground = (value?: string | null) =>
  Boolean(value && /^(https?:\/\/|data:|blob:|\/)/i.test(value.trim()));

const getSolidBackgroundColor = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;

  if (/^linear-gradient/i.test(normalized)) {
    const colors = normalized.match(/#(?:[0-9a-fA-F]{3}){1,2}/g);
    return colors?.[0] || undefined;
  }

  if (/^(#|rgb|hsl)/i.test(normalized)) {
    return normalized;
  }

  return undefined;
};

export default function ChatRoom() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const { validateFile, handleUploadError } = useMediaUpload();
  const {
    isOnline,
    status: offlineStatus,
    storeOfflineMessage,
  } = useOfflineQueue();
  const {
    activeConversation,
    setMessages,
    typingUsers,
    addMessage,
    updateMessage,
    setActiveConversation,
    updateConversation,
  } = useChatStore();

  // ✅ Dùng selector để tự re-render khi có tin mới
  const messages = useChatStore(
    (state) => state.messages[conversationId || ""] || [],
  );

  const [message, setMessage] = useState("");

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedInfoSections, setExpandedInfoSections] = useState<
    Record<InfoPanelSectionKey, boolean>
  >({
    media: true,
    files: true,
    links: true,
  });
  const [showAllInfoItems, setShowAllInfoItems] = useState<
    Record<InfoPanelSectionKey, boolean>
  >({
    media: false,
    files: false,
    links: false,
  });
  const [searchMessageQuery, setSearchMessageQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchMessageQuery, 300);
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [announcementMode, setAnnouncementMode] = useState(false);
  const [isPinningMessage, setIsPinningMessage] = useState(false);
  const [pinHistoryEntries, setPinHistoryEntries] = useState<PinHistoryEntry[]>(
    [],
  );
  const [pendingMediaList, setPendingMediaList] = useState<
    {
      file: File;
      type: "image" | "video" | "file";
      previewUrl?: string;
    }[]
  >([]);
  const [isMutingConversation, setIsMutingConversation] = useState(false);
  const [isBlockingUser, setIsBlockingUser] = useState(false);
  const [blockStatus, setBlockStatus] = useState<
    "none" | "blocked_by_me" | "blocked_by_other"
  >("none");
  const [isSummarizingConversation, setIsSummarizingConversation] =
    useState(false);
  const [dailySummary, setDailySummary] = useState<{
    conversationName: string;
    summary: string;
    messageCount: number;
    date: string;
  } | null>(null);

  // Pagination state
  const pagination = useMessagePagination(conversationId);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pinnedMessageRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const stickerPickerRef = useRef<HTMLDivElement>(null);

  const typing = conversationId ? typingUsers[conversationId] || [] : [];
  const displayMessages = useMemo(
    () => mergeMessagesWithPinHistory(messages, pinHistoryEntries),
    [messages, pinHistoryEntries],
  );

  const markMessageAsRead = useCallback(
    (messageId: string) => {
      if (!conversationId || !user?.id) return;

      socketService.markAsRead(conversationId, messageId, user.id);

      const msg = (useChatStore.getState().messages[conversationId] || []).find(
        (m) => m.id === messageId,
      );
      if (!msg) return;

      const alreadyRead = msg.readBy.some((r) => r.userId === user.id);
      if (!alreadyRead) {
        updateMessage(conversationId, messageId, {
          readBy: [
            ...msg.readBy,
            { userId: user.id, readAt: new Date().toISOString() },
          ],
        });
      }
    },
    [conversationId, user?.id, updateMessage],
  );

  // Click outside emoji picker & menu & sticker picker → đóng
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
      if (
        stickerPickerRef.current &&
        !stickerPickerRef.current.contains(e.target as Node)
      ) {
        setShowStickerPicker(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showEmojiPicker || showStickerPicker || showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker, showStickerPicker, showMenu]);

  // Xử lý chọn emoji
  const onEmojiClick = useCallback((emojiData: EmojiClickData) => {
    setMessage((prev) => prev + emojiData.emoji);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, []);

  // Scroll to bottom khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  useEffect(() => {
    pinnedMessageRef.current = activeConversation?.groupSettings?.pinnedMessage || null;
  }, [activeConversation?.groupSettings?.pinnedMessage]);

  useEffect(() => {
    if (!conversationId) {
      setPinHistoryEntries([]);
      return;
    }

    setPinHistoryEntries(loadPinHistoryEntries(conversationId));
  }, [conversationId]);

  // Load messages từ API lần đầu
  useEffect(() => {
    if (!conversationId) return;
    const msgs = useChatStore.getState().messages[conversationId] || [];
    const hasBrokenPollCache = msgs.some(
      (msg) => msg.type === "poll" && !msg.content?.poll,
    );
    if (msgs.length === 0 || hasBrokenPollCache) {
      getMessages(conversationId)
        .then((data) => setMessages(conversationId, data))
        .catch((err) => console.error("Load messages error:", err));
    }
  }, [conversationId]);

  // Set active conversation — subscribe to conversations so it re-runs
  // when the conversation list finishes loading from the API
  const conversations = useChatStore((state) => state.conversations);
  const { setConversations } = useChatStore();

  useEffect(() => {
    if (!conversationId) return;

    const trySetActive = () => {
      const conv = useChatStore.getState().getConversationById(conversationId);
      if (conv) {
        useChatStore.getState().setActiveConversation(conv);
        return true;
      }
      return false;
    };

    // Nếu đã có conversations trong store → set active ngay
    if (trySetActive()) return;

    // Nếu chưa có (vd: user truy cập URL trực tiếp) → tự load từ API
    if (conversations.length === 0) {
      getConversation()
        .then((convs) => {
          setConversations(convs);
          // Sau khi load xong, tìm lại conversation
          const conv = convs.find((c: any) => c.id === conversationId);
          if (conv) {
            useChatStore.getState().setActiveConversation(conv);
          }
        })
        .catch((err) => console.error("Error loading conversations:", err));
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    setAnnouncementMode(false);
    setDailySummary(null);
    setIsSummarizingConversation(false);
    setShowAllInfoItems({
      media: false,
      files: false,
      links: false,
    });
    setExpandedInfoSections({
      media: true,
      files: true,
      links: true,
    });
  }, [conversationId]);

  useEffect(() => {
    return () => {
      pendingMediaList.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [pendingMediaList]);

  useEffect(() => {
    if (
      !conversationId ||
      !activeConversation ||
      activeConversation.type !== "group"
    )
      return;

    getGroupSettings(conversationId)
      .then((settings) => {
        if (!settings) return;

        useChatStore.getState().updateConversation(conversationId, {
          groupSettings: {
            invite: {
              code: settings.invite?.code || "",
              approvalRequired: Boolean(settings.invite?.approvalRequired),
            },
            joinRequests: settings.pendingJoinRequests || [],
            permissions: {
              sendMedia: settings.permissions?.sendMedia || "all",
              pinMessage: settings.permissions?.pinMessage || "admin_deputy",
              sendAnnouncement:
                settings.permissions?.sendAnnouncement || "admin_deputy",
            },
            pinnedMessage: settings.pinnedMessage || null,
          },
        });
      })
      .catch((error) => {
        console.error("Load group settings error:", error);
      });
  }, [conversationId, activeConversation?.id, activeConversation?.type]);

  // ✅ Vào phòng socket + lắng nghe tin nhắn realtime
  useEffect(() => {
    if (!conversationId) return;
    if (user?.id && !socketService.isConnected()) {
      socketService.connect(user.id);
    }

    updateConversation(conversationId, { unreadCount: 0 });
    socketService.joinRoom(conversationId);

    const handleTyping = ({ userId }: { userId: string }) => {
      if (userId !== user?.id) {
        useChatStore.getState().addTypingUser(conversationId, userId);
      }
    };

    const handleStopTyping = ({ userId }: { userId: string }) => {
      useChatStore.getState().removeTypingUser(conversationId, userId);
    };

    socketService.on("chat:typing", handleTyping);
    socketService.on("chat:stop_typing", handleStopTyping);

    return () => {
      socketService.leaveRoom(conversationId);
      socketService.off("chat:typing", handleTyping);
      socketService.off("chat:stop_typing", handleStopTyping);
    };
  }, [conversationId, user?.id, updateConversation]);

  // Sau khi messages được load vào phòng hiện tại, auto read message mới nhất chưa đọc
  useEffect(() => {
    if (!conversationId || !user?.id || messages.length === 0) return;

    const latestUnreadFromOthers = [...messages].reverse().find((m) => {
      const readBy = Array.isArray(m.readBy) ? m.readBy : [];
      return (
        m.senderId !== user.id && !readBy.some((r) => r.userId === user.id)
      );
    });

    if (latestUnreadFromOthers) {
      markMessageAsRead(latestUnreadFromOthers.id);
      updateConversation(conversationId, { unreadCount: 0 });
    }
  }, [
    messages,
    conversationId,
    user?.id,
    markMessageAsRead,
    updateConversation,
  ]);

  // ✅ Gửi tin nhắn qua socket (hoặc lưu offline nếu không có kết nối)
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!conversationId || !user) return;
    if (isMessagingBlocked) {
      addToast(
        isBlockedByMe
          ? "Bạn đã chặn người dùng này. Hãy mở chặn để nhắn tin."
          : "Bạn đã bị chặn",
        "warning",
        3500,
      );
      return;
    }
    if (!message.trim() && pendingMediaList.length === 0) return;
    if (
      activeConversation?.type === "group" &&
      announcementMode &&
      !canSendAnnouncementInGroup
    ) {
      addToast(
        "Bạn không có quyền gửi thông báo trong nhóm này.",
        "error",
        4000,
      );
      return;
    }
    if (pendingMediaList.length > 0) {
      const caption = message.trim();
      for (const media of pendingMediaList) {
        await sendMediaMessage(
          media.file,
          media.type,
          undefined,
          caption || undefined,
        );
        // Only attach caption to the first media
        if (caption) caption === "";
      }
      clearPendingMedia();
      setMessage("");
      setReplyTo(null);
      setAnnouncementMode(false);
      return;
    }

    // Dừng trạng thái typing ngay khi đã gửi tin nhắn
    clearTimeout(typingTimeoutRef.current);
    socketService.stopTyping(conversationId, user.id);

    const messageText = message.trim();
    const isAnnouncement =
      activeConversation?.type === "group" && announcementMode;
    setMessage("");
    setReplyTo(null);
    setAnnouncementMode(false);

    // ✅ Optimistic update — hiện tin nhắn ngay lập tức
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversationId,
      senderId: user.id,
      type: "text",
      content: { text: messageText },
      metadata: isAnnouncement ? { isAnnouncement: true } : null,
      replyTo: replyTo || undefined,
      reactions: [],
      readBy: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
    };
    addMessage(conversationId, optimisticMsg);

    // Check if online
    if (!isOnline) {
      // Store offline message for later sync
      try {
        await storeOfflineMessage(
          conversationId,
          user.id,
          "text",
          { text: messageText },
          isAnnouncement ? { isAnnouncement: true } : undefined,
          replyTo || undefined,
        );
        addToast(
          "Bạn đang offline. Tin nhắn sẽ được gửi khi có kết nối.",
          "info",
          3000,
        );
      } catch (error) {
        console.error("Failed to store offline message:", error);
        useChatStore.getState().removeMessage(conversationId, tempId);
        addToast("Lỗi khi lưu tin nhắn ngoại tuyến", "error", 3000);
      }
      return;
    }

    if (!socketService.isConnected()) {
      try {
        const saved = await sendMessageApi({
          conversationId,
          type: "text",
          content: { text: messageText },
          metadata: isAnnouncement ? { isAnnouncement: true } : undefined,
          replyTo: replyTo || undefined,
        });
        useChatStore.getState().removeMessage(conversationId, tempId);
        addMessage(conversationId, normalizeMessage(saved));
      } catch (httpError) {
        useChatStore.getState().removeMessage(conversationId, tempId);
        console.error("Gửi tin nhắn thất bại (no-socket):", httpError);
        addToast("Không thể gửi tin nhắn. Vui lòng thử lại.", "error", 3000);
      }
      return;
    }

    // Gửi qua socket với ACK timeout + fallback HTTP để đảm bảo persistence
    const ack = await new Promise<{
      success: boolean;
      message?: Message;
      error?: string;
    }>((resolve) => {
      let done = false;
      const timeout = setTimeout(() => {
        if (done) return;
        done = true;
        resolve({ success: false, error: "ACK_TIMEOUT" });
      }, 2000);

      socketService.sendMessage(
        {
          conversationId,
          senderId: user.id,
          type: "text",
          content: { text: messageText },
          metadata: isAnnouncement ? { isAnnouncement: true } : undefined,
          replyTo: replyTo || undefined,
        },
        (res) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          resolve(res);
        },
      );
    });

    if (ack.success && ack.message) {
      useChatStore.getState().removeMessage(conversationId, tempId);
      addMessage(conversationId, normalizeMessage(ack.message));
    } else {
      try {
        const saved = await sendMessageApi({
          conversationId,
          type: "text",
          content: { text: messageText },
          metadata: isAnnouncement ? { isAnnouncement: true } : undefined,
          replyTo: replyTo || undefined,
        });
        useChatStore.getState().removeMessage(conversationId, tempId);
        addMessage(conversationId, normalizeMessage(saved));
      } catch (httpError) {
        useChatStore.getState().removeMessage(conversationId, tempId);
        console.error("Gửi tin nhắn thất bại:", ack.error, httpError);
        addToast("Không thể gửi tin nhắn. Vui lòng thử lại.", "error", 3000);
      }
    }

    // Cập nhật lastMessage trong sidebar ngay
    updateConversation(conversationId, {
      lastMessage: {
        content: isAnnouncement ? `[Thông báo] ${messageText}` : messageText,
        type: "text",
        senderId: user.id,
        timestamp: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });

    // Reset height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleForwardSend = (targetConversationIds: string[]) => {
    if (!forwardMessage || !user) return;

    targetConversationIds.forEach((targetId) => {
      const forwardedMetadata = {
        ...(forwardMessage.metadata || {}),
        isForwarded: true,
        forwardedFromMessageId: forwardMessage.id,
        forwardedAt: new Date().toISOString(),
      };
      const tempId = `temp-fw-${Date.now()}-${Math.random()}`;
      const optimisticMsg: Message = {
        id: tempId,
        conversationId: targetId,
        senderId: user.id,
        type: forwardMessage.type,
        content: forwardMessage.content,
        metadata: forwardedMetadata,
        reactions: [],
        readBy: [],
        isDeleted: false,
        createdAt: new Date().toISOString(),
      };
      addMessage(targetId, optimisticMsg);

      socketService.sendMessage(
        {
          conversationId: targetId,
          senderId: user.id,
          type: forwardMessage.type,
          content: forwardMessage.content,
          metadata: forwardedMetadata,
        },
        (res) => {
          const store = useChatStore.getState();
          if (res.success) {
            store.removeMessage(targetId, tempId);
            store.addMessage(targetId, res.message);
          } else {
            store.removeMessage(targetId, tempId);
            console.error("Chuyển tiếp thất bại:", res.error);
          }
        },
      );
      updateConversation(targetId, {
        lastMessage: {
          content: forwardMessage.content,
          type: forwardMessage.type,
          senderId: user.id,
          timestamp: new Date().toISOString(),
          metadata: forwardedMetadata,
        },
        updatedAt: new Date().toISOString(),
      });
    });

    setForwardMessage(null);
  };

  // ✅ Typing indicator với debounce
  const handleTyping = () => {
    if (!conversationId || !user) return;

    socketService.sendTyping(conversationId, user.id);

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(conversationId, user.id);
    }, 2000);
  };

  // Cleanup typing timer + emit stop typing khi đổi phòng/unmount
  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
      if (conversationId && user?.id) {
        socketService.stopTyping(conversationId, user.id);
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
        mediaRecorderRef.current.stop();
      }
    };
  }, [conversationId, user?.id]);

  // Auto-scale textarea height
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      const newHeight = Math.min(inputRef.current.scrollHeight, 150);
      inputRef.current.style.height = `${newHeight}px`;
    }
  }, [message]);

  const handleRecall = (messageId: string) => {
    if (!conversationId || !user) return;
    socketService.recallMessage(
      {
        messageId,
        conversationId,
        senderId: user.id,
      },
      (res) => {
        if (res.success) {
          // Optimistic update — đánh dấu tin nhắn đã xóa ngay
          useChatStore.getState().updateMessage(conversationId, messageId, {
            isDeleted: true,
          });
        } else {
          console.error("Thu hồi thất bại:", res.error);
        }
      },
    );
  };

  // ✅ Reaction handler
  const handleReact = (messageId: string, emoji: string) => {
    if (!conversationId || !user) return;
    // Optimistic update — thêm reaction ngay
    const currentMessages =
      useChatStore.getState().messages[conversationId] || [];
    const msg = currentMessages.find((m) => m.id === messageId);
    if (msg) {
      const existingReaction = msg.reactions.find((r) => r.userId === user.id);
      let newReactions;
      if (existingReaction && existingReaction.emoji === emoji) {
        // Toggle off — bỏ reaction
        newReactions = msg.reactions.filter((r) => r.userId !== user.id);
      } else {
        // Thêm/thay đổi reaction
        newReactions = [
          ...msg.reactions.filter((r) => r.userId !== user.id),
          { userId: user.id, emoji },
        ];
      }
      useChatStore.getState().updateMessage(conversationId, messageId, {
        reactions: newReactions,
      });
    }

    // Gửi qua socket
    socketService.reactToMessage({
      messageId,
      conversationId,
      userId: user.id,
      emoji,
    });
  };

  const clearPendingMedia = () => {
    pendingMediaList.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setPendingMediaList([]);
  };

  const removePendingMediaItem = (index: number) => {
    setPendingMediaList((prev) => {
      const item = prev[index];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const sendMediaMessage = async (
    file: File,
    type: "image" | "video" | "file" | "voice",
    duration?: number,
    caption?: string,
  ) => {
    if (!conversationId || !user) return;
    if (isMessagingBlocked) {
      addToast(
        isBlockedByMe
          ? "Bạn đã chặn người dùng này. Hãy mở chặn để gửi tin."
          : "Bạn đã bị chặn",
        "warning",
        3500,
      );
      return;
    }
    if (activeConversation?.type === "group" && !canSendMediaInGroup) {
      addToast("Bạn không có quyền gửi media trong nhóm này.", "error", 4000);
      return;
    }

    // Validate file
    const validation = validateFile(file, type);
    if (!validation.valid) {
      return;
    }

    try {
      setIsSendingMedia(true);
      addToast("Đang gửi...", "info");

      // Check if offline
      if (!isOnline) {
        addToast(
          "Bạn đang offline. Không thể gửi media lúc này.",
          "warning",
          3000,
        );
        return;
      }
      const canUseSocket = socketService.isConnected();

      // Upload media qua HTTP SDK (S3) thay vì Base64 socket cực tốn băng thông
      let mediaUrl = "";
      if (type !== "voice") {
        const uploadRes = await uploadMedia(file);
        mediaUrl = uploadRes.url;
      } else {
        // Voice message could be small enough for socket or you can format it for FormData too
        // Dùng uploadMedia cho voice luôn
        const voiceFile = new File([file], `voice_${Date.now()}.webm`, {
          type: "audio/webm",
        });
        const uploadRes = await uploadMedia(voiceFile);
        mediaUrl = uploadRes.url;
      }

      const content: any = {
        mediaUrl: mediaUrl,
        fileName: file.name,
        fileSize: file.size,
      };
      if (caption) {
        content.text = caption;
      }

      // Add duration for voice messages
      if (type === "voice" && duration !== undefined) {
        content.duration = duration;
      }

      const tempId = `temp-media-${Date.now()}`;
      const optimisticMsg: Message = {
        id: tempId,
        conversationId,
        senderId: user.id,
        type,
        content,
        replyTo: replyTo || undefined,
        reactions: [],
        readBy: [],
        isDeleted: false,
        createdAt: new Date().toISOString(),
      };
      addMessage(conversationId, optimisticMsg);

      if (canUseSocket) {
        const ack = await new Promise<{
          success: boolean;
          message?: Message;
          error?: string;
        }>((resolve) => {
          let done = false;
          const timeout = setTimeout(() => {
            if (done) return;
            done = true;
            resolve({ success: false, error: "ACK_TIMEOUT" });
          }, 2000);

          socketService.sendMessage(
            {
              conversationId,
              senderId: user.id,
              type,
              content,
              replyTo: replyTo || undefined,
            },
            (res) => {
              if (done) return;
              done = true;
              clearTimeout(timeout);
              resolve(res);
            },
          );
        });

        if (ack.success && ack.message) {
          useChatStore.getState().removeMessage(conversationId, tempId);
          addMessage(conversationId, normalizeMessage(ack.message));
          addToast("Gửi thành công!", "success", 3000);
        } else {
          // Socket ACK timeout/failure fallback: persist via HTTP API
          try {
            const saved = await sendMessageApi({
              conversationId,
              type,
              content,
              replyTo: replyTo || undefined,
            });

            const normalizedSaved = normalizeMessage(saved);
            useChatStore.getState().removeMessage(conversationId, tempId);
            addMessage(conversationId, normalizedSaved);
            addToast("Đã gửi thành công (qua kênh dự phòng).", "success", 3000);
          } catch (httpError) {
            useChatStore.getState().removeMessage(conversationId, tempId);
            const errMsg =
              ack.error === "ACK_TIMEOUT"
                ? "Không nhận được xác nhận từ máy chủ. Vui lòng thử gửi lại."
                : ack.error || "Vui lòng thử lại.";
            addToast(`Gửi thất bại: ${errMsg}`, "error", 5000);
            console.error("Media fallback HTTP failed:", httpError);
            return;
          }
        }
      } else {
        // Socket ACK timeout/failure fallback: persist via HTTP API
        try {
          const saved = await sendMessageApi({
            conversationId,
            type,
            content,
            replyTo: replyTo || undefined,
          });

          const normalizedSaved = normalizeMessage(saved);
          useChatStore.getState().removeMessage(conversationId, tempId);
          addMessage(conversationId, normalizedSaved);
          addToast("Đã gửi thành công.", "success", 3000);
        } catch (httpError) {
          useChatStore.getState().removeMessage(conversationId, tempId);
          addToast("Gửi thất bại: Vui lòng thử lại.", "error", 5000);
          console.error("Media fallback HTTP failed:", httpError);
          return;
        }
      }

      updateConversation(conversationId, {
        lastMessage: {
          content:
            type === "image"
              ? "[Hình ảnh]"
              : type === "video"
                ? "[Video]"
                : type === "voice"
                  ? "[Tin nhắn thoại]"
                  : `[File] ${file.name}`,
          type,
          senderId: user.id,
          timestamp: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleUploadError(error, type);
    } finally {
      setIsSendingMedia(false);
    }
  };

  const handlePickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = "";

    if (!selectedFiles.length) return;

    const newItems: {
      file: File;
      type: "image" | "video";
      previewUrl: string;
    }[] = [];
    for (const file of selectedFiles) {
      const type = file.type.startsWith("video/")
        ? ("video" as const)
        : ("image" as const);
      const validation = validateFile(file, type);
      if (!validation.valid) continue;
      newItems.push({
        file,
        type,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (newItems.length > 0) {
      setPendingMediaList((prev) => [...prev, ...newItems]);
    }
  };

  const handlePickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file, "file");
    if (!validation.valid) {
      e.target.value = "";
      return;
    }

    setPendingMediaList((prev) => [...prev, { file, type: "file" as const }]);
    e.target.value = "";
  };

  const handleToggleRecord = async () => {
    if (activeConversation?.type === "group" && !canSendMediaInGroup) {
      addToast("Bạn không có quyền gửi media trong nhóm này.", "error", 4000);
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });

          if (audioChunksRef.current.length > 0) {
            const file = new File([audioBlob], `voice_${Date.now()}.webm`, {
              type: "audio/webm",
            });
            await sendMediaMessage(file, "voice", recordingTime);
          }
          setRecordingTime(0);
        };

        mediaRecorder.start(200);
        setIsRecording(true);
        setRecordingTime(0);

        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error("Lỗi khi thu âm:", err);
        if (err instanceof Error && err.name === "NotAllowedError") {
          addToast(
            "Quyền truy cập Microphone bị từ chối. Vui lòng cấp quyền trong cài đặt.",
            "error",
            5000,
          );
        } else if (err instanceof Error && err.name === "NotFoundError") {
          addToast(
            "Không tìm thấy Microphone. Vui lòng kiểm tra kết nối thiết bị.",
            "error",
            5000,
          );
        } else {
          addToast(
            "Không thể truy cập Microphone. Vui lòng thử lại.",
            "error",
            5000,
          );
        }
      }
    }
  };

  const handleSendSticker = async (stickerUrl: string) => {
    if (!conversationId || !user) return;
    if (isMessagingBlocked) {
      addToast(
        isBlockedByMe
          ? "Bạn đã chặn người dùng này. Hãy mở chặn để gửi tin."
          : "Bạn đã bị chặn",
        "warning",
        3500,
      );
      return;
    }
    if (activeConversation?.type === "group" && !canSendMediaInGroup) {
      addToast("Bạn không có quyền gửi media trong nhóm này.", "error", 4000);
      return;
    }

    const content = { mediaUrl: stickerUrl };
    const tempId = `temp-sticker-${Date.now()}`;

    const stickerMsg: Message = {
      id: tempId,
      conversationId,
      senderId: user.id,
      type: "sticker",
      content,
      replyTo: replyTo || undefined,
      reactions: [],
      readBy: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
    };
    addMessage(conversationId, stickerMsg);
    setShowStickerPicker(false);
    setReplyTo(null);

    if (!isOnline) {
      try {
        await storeOfflineMessage(
          conversationId,
          user.id,
          "sticker",
          content,
          undefined,
          replyTo || undefined,
        );
        addToast(
          "Bạn đang offline. Sticker sẽ được gửi khi có kết nối.",
          "info",
          3000,
        );
      } catch (error) {
        useChatStore.getState().removeMessage(conversationId, tempId);
        console.error("Failed to store offline sticker:", error);
        addToast("Lỗi khi lưu sticker ngoại tuyến", "error", 3000);
        return;
      }

      updateConversation(conversationId, {
        lastMessage: {
          content: "[Nhãn dán]",
          type: "sticker",
          senderId: user.id,
          timestamp: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    let sentMessage: Message | null = null;

    if (socketService.isConnected()) {
      const ack = await new Promise<{
        success: boolean;
        message?: Message;
        error?: string;
      }>((resolve) => {
        let done = false;
        const timeout = setTimeout(() => {
          if (done) return;
          done = true;
          resolve({ success: false, error: "ACK_TIMEOUT" });
        }, 2000);

        socketService.sendMessage(
          {
            conversationId,
            senderId: user.id,
            type: "sticker",
            content,
            replyTo: replyTo || undefined,
          },
          (res) => {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            resolve(res);
          },
        );
      });

      if (ack.success && ack.message) {
        sentMessage = normalizeMessage(ack.message);
      }
    }

    if (!sentMessage) {
      try {
        sentMessage = await sendMessageApi({
          conversationId,
          type: "sticker",
          content,
          replyTo: replyTo || undefined,
        });
      } catch (error) {
        useChatStore.getState().removeMessage(conversationId, tempId);
        console.error("Gửi sticker thất bại:", error);
        addToast("Không thể gửi sticker. Vui lòng thử lại.", "error", 3000);
        return;
      }
    }

    useChatStore.getState().removeMessage(conversationId, tempId);
    addMessage(conversationId, normalizeMessage(sentMessage));

    updateConversation(conversationId, {
      lastMessage: {
        content: "[Nhãn dán]",
        type: "sticker",
        senderId: user.id,
        timestamp: sentMessage?.createdAt || new Date().toISOString(),
      },
      updatedAt: sentMessage?.createdAt || new Date().toISOString(),
    });
  };

  const handleSubmitPoll = useCallback(
    async (values: {
      question: string;
      options: string[];
      pinToConversation: boolean;
      anonymousVoters: boolean;
      hideResultsUntilVote: boolean;
      allowMultipleChoices: boolean;
      allowAddOptions: boolean;
      expiresAt: string | null;
    }) => {
      if (!conversationId || !activeConversation || activeConversation.type !== "group") {
        addToast("Chỉ tạo được bình chọn trong nhóm", "error", 3000);
        return;
      }

      const role = String(
        activeConversation.participants.find(
          (participant) => String(participant.userId) === String(user?.id),
        )?.role || "member",
      ).toLowerCase();
      const pinScope = String(
        activeConversation.groupSettings?.permissions?.pinMessage || "admin_deputy",
      ).toLowerCase();
      const roleRank: Record<string, number> = {
        member: 1,
        deputy: 2,
        admin: 3,
      };
      const scopeRank: Record<string, number> = {
        all: 1,
        admin_deputy: 2,
        admin: 3,
      };
      const canPinCreatedPoll =
        (roleRank[role] || 0) >= (scopeRank[pinScope] || Number.MAX_SAFE_INTEGER);

      try {
        const saved = await sendMessageApi({
          conversationId,
          type: "poll",
          content: {
            question: values.question,
            options: values.options.map((text) => ({ text })),
            settings: {
              anonymousVoters: values.anonymousVoters,
              hideResultsUntilVote: values.hideResultsUntilVote,
              allowMultipleChoices: values.allowMultipleChoices,
              allowAddOptions: values.allowAddOptions,
              expiresAt: values.expiresAt,
            },
          },
        });

        addMessage(conversationId, normalizeMessage(saved));

        if (values.pinToConversation && canPinCreatedPoll) {
          try {
            await pinGroupMessage(conversationId, saved.id);
          } catch (error) {
            console.error("Pin poll error:", error);
            addToast("Đã tạo bình chọn nhưng không thể ghim bình chọn", "warning", 3200);
          }
        }

        addToast("Đã tạo bình chọn", "success", 2500);
      } catch (error) {
        console.error("Create poll error:", error);
        addToast("Không thể tạo bình chọn lúc này", "error", 3200);
        throw error;
      }
    },
    [activeConversation, addMessage, addToast, conversationId, user?.id],
  );

  const handleVotePoll = useCallback(
    async (messageId: string, optionIds: string[]) => {
      try {
        const updated = await votePoll(messageId, optionIds);
        useChatStore
          .getState()
          .updateMessage(String(updated.conversationId), String(updated.id), updated);
        addToast("Đã cập nhật bình chọn", "success", 2200);
      } catch (error) {
        console.error("Vote poll error:", error);
        addToast("Không thể cập nhật bình chọn", "error", 3200);
        throw error;
      }
    },
    [addToast],
  );

  const handleAddPollOption = useCallback(
    async (messageId: string, text: string) => {
      try {
        const updated = await addPollOption(messageId, text);
        useChatStore
          .getState()
          .updateMessage(String(updated.conversationId), String(updated.id), updated);
        addToast("Đã thêm phương án", "success", 2200);
      } catch (error) {
        console.error("Add poll option error:", error);
        addToast("Không thể thêm phương án", "error", 3200);
        throw error;
      }
    },
    [addToast],
  );

  const handleRemovePollOption = useCallback(
    async (messageId: string, optionId: string) => {
      try {
        const updated = await removePollOption(messageId, optionId);
        useChatStore
          .getState()
          .updateMessage(String(updated.conversationId), String(updated.id), updated);
        addToast("Đã xóa phương án", "success", 2200);
      } catch (error) {
        console.error("Remove poll option error:", error);
        addToast("Không thể xóa phương án", "error", 3200);
        throw error;
      }
    },
    [addToast],
  );

  const buildPinnedSettings = useCallback(
    (nextPinned: any) => ({
      ...(activeConversation?.groupSettings || {
        invite: { code: "", approvalRequired: true },
        joinRequests: [],
        permissions: {
          sendMedia: "all",
          pinMessage:
            activeConversation?.type === "group" ? "admin_deputy" : "all",
          sendAnnouncement:
            activeConversation?.type === "group" ? "admin_deputy" : "all",
        },
      }),
      pinnedMessage: nextPinned,
    }),
    [activeConversation?.groupSettings, activeConversation?.type],
  );

  const getPinnedMessagePreview = useCallback((message: any) => {
    if (!message) return "Tin nhắn đã ghim";
    if (message.metadata?.isAnnouncement) {
      const announceText = String(message.content?.text || "").trim();
      return announceText ? `[Thông báo] ${announceText}` : "[Thông báo]";
    }

    if (typeof message.content?.text === "string" && message.content.text.trim()) {
      return message.content.text.trim();
    }
    if (
      typeof message.content?.fileName === "string" &&
      message.content.fileName.trim()
    ) {
      return `[File] ${message.content.fileName.trim()}`;
    }

    if (message.type === "image") return "[Hình ảnh]";
    if (message.type === "video") return "[Video]";
    if (message.type === "voice") return "[Tin nhắn thoại]";
    if (message.type === "sticker") return "[Nhãn dán]";
    if (message.type === "file") return "[Tập tin]";
    return "Tin nhắn đã ghim";
  }, []);

  const resolvePinActorName = useCallback(
    (actorId: string) => {
      const normalizedActorId = String(actorId || "").trim();
      if (!normalizedActorId) return "User";

      if (String(user?.id || "") === normalizedActorId) {
        return String(user?.fullName || "User").trim() || "User";
      }

      const participantName = activeConversation?.participants?.find(
        (participant) => String(participant.userId) === normalizedActorId,
      )?.fullName;
      if (typeof participantName === "string" && participantName.trim()) {
        return participantName.trim();
      }

      return "User";
    },
    [activeConversation?.participants, user?.fullName, user?.id],
  );

  const appendPinnedHistory = useCallback(
    (nextPinnedMessage: any | null, updatedBy?: string) => {
      if (!conversationId) return;

      const previousPinnedMessage = pinnedMessageRef.current;
      const previousKey = previousPinnedMessage
        ? `${String(previousPinnedMessage.messageId || "")}:${String(previousPinnedMessage.pinnedAt || "")}:${String(previousPinnedMessage.pinnedBy || "")}`
        : "";
      const nextKey = nextPinnedMessage
        ? `${String(nextPinnedMessage.messageId || "")}:${String(nextPinnedMessage.pinnedAt || "")}:${String(nextPinnedMessage.pinnedBy || "")}`
        : "";

      if (previousKey === nextKey) return;

      const normalizedActorId = String(
        updatedBy || nextPinnedMessage?.pinnedBy || user?.id || "",
      ).trim();
      const action = nextPinnedMessage ? "pin" : "unpin";
      const targetPinnedMessage = nextPinnedMessage || previousPinnedMessage;
      const targetMessageId = String(
        targetPinnedMessage?.messageId || "",
      ).trim();
      if (!targetMessageId) return;

      const createdAt =
        action === "pin" && String(nextPinnedMessage?.pinnedAt || "").trim()
          ? String(nextPinnedMessage.pinnedAt)
          : new Date().toISOString();
      const eventKey =
        action === "pin"
          ? `pin:${conversationId}:${normalizedActorId}:${targetMessageId}:${String(nextPinnedMessage?.pinnedAt || "")}`
          : `unpin:${conversationId}:${normalizedActorId}:${targetMessageId}:${String(previousPinnedMessage?.pinnedAt || "")}`;

      const nextEntries = appendPinHistoryEntry({
        eventKey,
        conversationId,
        actorId: normalizedActorId,
        actorName: resolvePinActorName(normalizedActorId),
        action,
        previewText: getPinnedMessagePreview(targetPinnedMessage),
        targetMessageId,
        createdAt,
      });

      setPinHistoryEntries(nextEntries);
    },
    [
      conversationId,
      getPinnedMessagePreview,
      resolvePinActorName,
      user?.id,
    ],
  );

  const handlePinMessage = async (messageId: string) => {
    if (!conversationId || !activeConversation) return;

    if (activeConversation.type === "group" && !canPinInGroup) {
      addToast(
        "Bạn không có quyền ghim tin nhắn trong nhóm này.",
        "error",
        4000,
      );
      return;
    }

    try {
      setIsPinningMessage(true);
      const result =
        activeConversation.type === "group"
          ? await pinGroupMessage(conversationId, messageId)
          : await pinConversationMessage(conversationId, messageId);
      const nextPinned =
        result.pinnedMessage ||
        result.conversation?.groupSettings?.pinnedMessage ||
        result.group?.groupSettings?.pinnedMessage ||
        null;

      appendPinnedHistory(nextPinned, user?.id);
      useChatStore.getState().updateConversation(conversationId, {
        groupSettings: buildPinnedSettings(nextPinned),
      });
      addToast("Đã ghim tin nhắn", "success", 2000);
    } catch (error: any) {
      addToast(error?.message || "Không thể ghim tin nhắn", "error", 4000);
    } finally {
      setIsPinningMessage(false);
    }
  };

  const handleUnpinMessage = async () => {
    if (!conversationId || !activeConversation) return;

    if (activeConversation.type === "group" && !canPinInGroup) {
      addToast(
        "Bạn không có quyền bỏ ghim tin nhắn trong nhóm này.",
        "error",
        4000,
      );
      return;
    }

    try {
      setIsPinningMessage(true);
      if (activeConversation.type === "group") {
        await unpinGroupMessage(conversationId);
      } else {
        await unpinConversationMessage(conversationId);
      }

      appendPinnedHistory(null, user?.id);
      useChatStore.getState().updateConversation(conversationId, {
        groupSettings: buildPinnedSettings(null),
      });
      addToast("Đã bỏ ghim tin nhắn", "success", 2000);
    } catch (error: any) {
      addToast(error?.message || "Không thể bỏ ghim tin nhắn", "error", 4000);
    } finally {
      setIsPinningMessage(false);
    }
  };

  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const socket = socketService.getSocket() || socketService.connect(user.id);
    if (!socket) return;

    const onPinnedMessage = ({
      conversationId: incomingConversationId,
      pinnedMessage: nextPinnedMessage,
      updatedBy,
    }: {
      conversationId: string;
      pinnedMessage: any | null;
      updatedBy?: string;
    }) => {
      if (String(incomingConversationId) !== String(conversationId)) return;
      appendPinnedHistory(nextPinnedMessage || null, updatedBy);
      // Update conversation state to reflect pin/unpin changes from other users
      useChatStore.getState().updateConversation(conversationId, {
        groupSettings: buildPinnedSettings(nextPinnedMessage || null),
      });
    };

    socket.on("chat:pinned_message", onPinnedMessage);

    return () => {
      socket.off("chat:pinned_message", onPinnedMessage);
    };
  }, [appendPinnedHistory, conversationId, user?.id]);

  const getOtherParticipant = () => {
    if (!activeConversation || activeConversation.type === "group") return null;
    return activeConversation.participants.find(
      (p) => String(p.userId) !== String(user?.id),
    );
  };

  const handleDeleteHistory = async () => {
    if (!conversationId) return;
    if (
      !confirm(
        "Bạn có chắc muốn xóa toàn bộ tin nhắn trong cuộc trò chuyện này không? Hành động này không thể hoàn tác.",
      )
    )
      return;

    try {
      await deleteChatHistory(conversationId);
      // Cập nhật lại list messages trên client về []
      useChatStore.getState().setMessages(conversationId, []);
      setShowMenu(false);
      // Clear preview
      updateConversation(conversationId, {
        lastMessage: undefined,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Lỗi khi xóa lịch sử", error);
      alert("Không thể xóa lịch sử trò chuyện lúc này.");
    }
  };

  const handleSummarizeConversationInDay = async () => {
    if (!conversationId) return;

    try {
      setIsSummarizingConversation(true);

      const result = await getDailyConversationSummary(
        conversationId,
        undefined,
        new Date().getTimezoneOffset(),
      );

      setDailySummary({
        conversationName: result.conversationName || "Cuộc trò chuyện",
        summary: result.summary,
        messageCount: result.messageCount,
        date: result.date,
      });

      addToast(
        result.messageCount > 0
          ? "Đã tạo tóm tắt cuộc trò chuyện hôm nay."
          : "Không có tin nhắn trong ngày để tóm tắt.",
        "success",
        2500,
      );
    } catch (error) {
      console.error("Summarize conversation error:", error);
      addToast("Không thể tóm tắt cuộc trò chuyện lúc này.", "error", 3500);
    } finally {
      setIsSummarizingConversation(false);
    }
  };

  const otherUser = getOtherParticipant();
  const currentP = activeConversation?.participants.find(
    (p) => String(p.userId) === String(user?.id),
  );
  const isBlockedByMe = blockStatus === "blocked_by_me";
  const isBlockedByOther = blockStatus === "blocked_by_other";
  const isPrivateConversation = activeConversation?.type !== "group";
  const isMessagingBlocked =
    isPrivateConversation && (isBlockedByMe || isBlockedByOther);
  const activeNickname = currentP?.nickname;
  const isMuted = currentP?.isMuted;
  const currentGroupRole = currentP?.role;

  useEffect(() => {
    if (
      !conversationId ||
      !activeConversation ||
      activeConversation.type === "group" ||
      !user?.id
    ) {
      setBlockStatus("none");
      return;
    }

    let cancelled = false;
    const run = async () => {
      const otherParticipant = activeConversation.participants.find(
        (participant) => String(participant.userId) !== String(user.id),
      );
      if (!otherParticipant?.userId) {
        if (!cancelled) setBlockStatus("none");
        return;
      }

      try {
        const relation = await friendsService.checkFriendship(
          String(user.id),
          String(otherParticipant.userId),
        );
        if (cancelled) return;

        if (!relation || String((relation as any).status) !== "blocked") {
          setBlockStatus("none");
          return;
        }

        const blockedByMe = String(relation.fromUserId) === String(user.id);
        setBlockStatus(blockedByMe ? "blocked_by_me" : "blocked_by_other");
      } catch {
        if (!cancelled) setBlockStatus("none");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeConversation, conversationId, user?.id]);

  useEffect(() => {
    if (!otherUser?.userId || !user?.id) return;

    const handleFriendBlocked = ({
      targetUserId,
    }: {
      targetUserId: string;
    }) => {
      if (String(targetUserId) !== String(otherUser.userId)) return;
      setBlockStatus("blocked_by_me");
      addToast("Đã chặn người dùng", "success", 2500);
    };

    const handleBlockedBy = ({
      blockedByUserId,
    }: {
      blockedByUserId: string;
    }) => {
      if (String(blockedByUserId) !== String(otherUser.userId)) return;
      setBlockStatus("blocked_by_other");
      addToast("Bạn đã bị chặn", "warning", 3000);
    };

    const handleFriendUnblocked = ({
      targetUserId,
    }: {
      targetUserId: string;
    }) => {
      if (String(targetUserId) !== String(otherUser.userId)) return;
      setBlockStatus("none");
      addToast("Đã mở chặn người dùng", "success", 2500);
    };

    const handleUnblockedBy = ({
      unblockedByUserId,
    }: {
      unblockedByUserId: string;
    }) => {
      if (String(unblockedByUserId) !== String(otherUser.userId)) return;
      setBlockStatus("none");
      addToast("Người dùng đã bỏ chặn bạn", "info", 2500);
    };

    socketService.on("friend:blocked", handleFriendBlocked);
    socketService.on("friend:blocked_by", handleBlockedBy);
    socketService.on("friend:unblocked", handleFriendUnblocked);
    socketService.on("friend:unblocked_by", handleUnblockedBy);

    return () => {
      socketService.off("friend:blocked", handleFriendBlocked);
      socketService.off("friend:blocked_by", handleBlockedBy);
      socketService.off("friend:unblocked", handleFriendUnblocked);
      socketService.off("friend:unblocked_by", handleUnblockedBy);
    };
  }, [addToast, otherUser?.userId, user?.id]);

  const canUseGroupScope = useCallback(
    (scope?: GroupPermissionScope) => {
      if (!scope) return true;
      const roleRank: Record<"member" | "deputy" | "admin", number> = {
        member: 1,
        deputy: 2,
        admin: 3,
      };
      const scopeRank: Record<GroupPermissionScope, number> = {
        all: 1,
        admin_deputy: 2,
        admin: 3,
      };
      const rank = currentGroupRole ? roleRank[currentGroupRole] : 0;
      return rank >= scopeRank[scope];
    },
    [currentGroupRole],
  );

  const groupPermissions = activeConversation?.groupSettings?.permissions;
  const canSendMediaInGroup =
    activeConversation?.type !== "group" ||
    canUseGroupScope(groupPermissions?.sendMedia);
  const canSendAnnouncementInGroup =
    activeConversation?.type !== "group" ||
    canUseGroupScope(groupPermissions?.sendAnnouncement);
  const canPinInGroup =
    activeConversation?.type === "group" &&
    canUseGroupScope(groupPermissions?.pinMessage);
  const canPinMessage =
    activeConversation?.type === "group"
      ? canPinInGroup
      : activeConversation?.type === "private";
  const pinnedMessage =
    activeConversation?.groupSettings?.pinnedMessage || null;
  const conversationBackground = String(activeConversation?.background || "").trim();
  const usesImageBackground = isImageBackground(conversationBackground);
  const chatAreaBackgroundColor =
    getSolidBackgroundColor(conversationBackground) || undefined;

  const handleUpdateNickname = async () => {
    if (!conversationId || !user) return;
    if (activeConversation?.type === "group") {
      alert("Hiện chỉ hỗ trợ đổi tên gợi nhớ trong trò chuyện cá nhân.");
      return;
    }

    const oldName = activeNickname || otherUser?.fullName || "";
    const newNickname = prompt("Nhập tên gợi nhớ (để trống để xóa):", oldName);
    if (newNickname === null) return;

    try {
      await updateParticipantSetting(conversationId, user.id, {
        nickname: newNickname.trim(),
      });
      useChatStore.getState().updateConversation(conversationId, {
        participants: activeConversation!.participants.map((part) =>
          String(part.userId) === String(user.id)
            ? { ...part, nickname: newNickname.trim() }
            : part,
        ),
      });
      setShowMenu(false);
    } catch (error) {
      console.error("Update nickname error", error);
      alert("Không thể đổi tên gợi nhớ lúc này.");
    }
  };

  const handleUpdateBackground = async (backgroundUrl: string) => {
    if (!conversationId) return;

    try {
      await updateConversationBackground(conversationId, backgroundUrl);
      useChatStore.getState().updateConversation(conversationId, {
        background: backgroundUrl,
      });
      addToast("Đổi hình nền thành công!", "success", 3000);
    } catch (error) {
      console.error("Update background error", error);
      addToast("Không thể đổi hình nền lúc này.", "error", 5000);
      throw error;
    }
  };

  const conversationName =
    activeConversation?.type === "group"
      ? activeConversation.name
      : activeNickname || otherUser?.fullName || "Người dùng";
  const conversationAvatar =
    activeConversation?.type === "group"
      ? activeConversation.avatar
      : otherUser?.avatarUrl;

  const toggleInfoSection = (section: InfoPanelSectionKey) => {
    setExpandedInfoSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleShowAllInfoItems = (section: InfoPanelSectionKey) => {
    setShowAllInfoItems((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleToggleSearch = () => {
    setIsSearching((prev) => {
      if (prev) {
        setSearchMessageQuery("");
      }
      return !prev;
    });
  };

  const handleToggleMuteConversation = async () => {
    if (!conversationId || !user || !activeConversation) return;

    const nextMuted = !Boolean(isMuted);
    try {
      setIsMutingConversation(true);
      await updateParticipantSetting(conversationId, user.id, {
        isMuted: nextMuted,
      });

      useChatStore.getState().updateConversation(conversationId, {
        participants: activeConversation.participants.map((participant) =>
          String(participant.userId) === String(user.id)
            ? { ...participant, isMuted: nextMuted }
            : participant,
        ),
      });

      addToast(
        nextMuted
          ? "Đã tắt thông báo hội thoại."
          : "Đã bật thông báo hội thoại.",
        "success",
        2500,
      );
    } catch (error) {
      console.error("Mute conversation error:", error);
      addToast("Không thể cập nhật thông báo hội thoại.", "error", 3500);
    } finally {
      setIsMutingConversation(false);
    }
  };

  const handleBlockUserInConversation = async () => {
    if (!otherUser?.userId || activeConversation?.type === "group") return;
    if (
      !confirm(
        `Chặn ${otherUser.fullName || "người dùng"}? Bạn sẽ không nhận tin nhắn từ người này nữa.`,
      )
    ) {
      return;
    }

    try {
      setIsBlockingUser(true);
      await friendsService.blockUser(String(otherUser.userId));
      setShowMenu(false);
      setBlockStatus("blocked_by_me");
      addToast("Đã chặn người dùng", "success", 2500);
    } catch (error) {
      console.error("Block user error:", error);
      addToast("Không thể chặn người dùng lúc này", "error", 3500);
    } finally {
      setIsBlockingUser(false);
    }
  };

  const handleUnblockUserInConversation = async () => {
    if (!otherUser?.userId || activeConversation?.type === "group") return;

    try {
      setIsBlockingUser(true);
      await friendsService.unblockUser(String(otherUser.userId));
      setShowMenu(false);
      setBlockStatus("none");
      addToast("Đã mở chặn người dùng", "success", 2500);
    } catch (error) {
      console.error("Unblock user error:", error);
      addToast("Không thể mở chặn người dùng lúc này", "error", 3500);
    } finally {
      setIsBlockingUser(false);
    }
  };

  const participantNameMap = useMemo(() => {
    const nameMap = new Map<string, string>();
    activeConversation?.participants.forEach((participant) => {
      nameMap.set(
        String(participant.userId),
        participant.fullName || "Người dùng",
      );
    });
    return nameMap;
  }, [activeConversation?.participants]);

  const sharedMedia = useMemo<SharedMediaItem[]>(() => {
    const items: SharedMediaItem[] = [];

    messages.forEach((msg) => {
      if (msg.isDeleted || !msg.content.mediaUrl) return;
      if (msg.type !== "image" && msg.type !== "video") return;

      items.push({
        id: msg.id,
        url: String(msg.content.mediaUrl),
        type: msg.type,
        createdAt: msg.createdAt,
        senderName:
          participantNameMap.get(String(msg.senderId)) || "Người dùng",
      });
    });

    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [messages, participantNameMap]);

  const sharedFiles = useMemo<SharedFileItem[]>(() => {
    const items = messages
      .filter((msg) => !msg.isDeleted && msg.type === "file")
      .map((msg) => ({
        id: msg.id,
        name:
          msg.content.fileName || parseFileNameFromUrl(msg.content.mediaUrl),
        url: msg.content.mediaUrl,
        size: msg.content.fileSize,
        createdAt: msg.createdAt,
        senderName:
          participantNameMap.get(String(msg.senderId)) || "Người dùng",
      }));

    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [messages, participantNameMap]);

  const sharedLinks = useMemo<SharedLinkItem[]>(() => {
    const items: SharedLinkItem[] = [];
    const dedupe = new Set<string>();

    messages.forEach((msg) => {
      if (msg.isDeleted || !msg.content.text) return;

      const matches = msg.content.text.match(/https?:\/\/[^\s]+/gi) || [];
      matches.forEach((rawUrl, index) => {
        const normalizedUrl = trimTrailingPunctuation(rawUrl.trim());
        if (!normalizedUrl) return;

        const dedupeKey = `${normalizedUrl}-${msg.id}-${index}`;
        if (dedupe.has(dedupeKey)) return;
        dedupe.add(dedupeKey);

        items.push({
          id: `${msg.id}-link-${index}`,
          url: normalizedUrl,
          host: getUrlHost(normalizedUrl),
          createdAt: msg.createdAt,
          senderName:
            participantNameMap.get(String(msg.senderId)) || "Người dùng",
        });
      });
    });

    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [messages, participantNameMap]);

  const visibleMedia = showAllInfoItems.media
    ? sharedMedia
    : sharedMedia.slice(0, 6);
  const visibleFiles = showAllInfoItems.files
    ? sharedFiles
    : sharedFiles.slice(0, 4);
  const visibleLinks = showAllInfoItems.links
    ? sharedLinks
    : sharedLinks.slice(0, 4);

  const commonGroupCount = useMemo(() => {
    if (!user?.id || !otherUser?.userId) return 0;

    return conversations.filter((conversation) => {
      if (conversation.type !== "group") return false;
      const participantIds = conversation.participants.map((participant) =>
        String(participant.userId),
      );
      return (
        participantIds.includes(String(user.id)) &&
        participantIds.includes(String(otherUser.userId))
      );
    }).length;
  }, [conversations, otherUser?.userId, user?.id]);

  const handleStartVideoCall = () => {
    if (!conversationId || !user) return;
    if (activeConversation?.type === "group") {
      useCallStore.getState().setOutgoingCall({
        isCaller: true,
        conversationId: conversationId,
        callerName: activeConversation.name || "Nhóm",
        callerAvatar: activeConversation.avatar || undefined,
        callType: "video",
        isGroupCall: true,
      });
      return;
    }
    if (!otherUser) return;
    useCallStore.getState().setOutgoingCall({
      isCaller: true,
      toUserId: otherUser.userId,
      conversationId: conversationId,
      callerName: user.fullName || "Người dùng",
      callerAvatar: user.avatarUrl || undefined,
      callType: "video",
    });
  };

  const handleStartVoiceCall = () => {
    if (!conversationId || !user) return;
    if (activeConversation?.type === "group") {
      useCallStore.getState().setOutgoingCall({
        isCaller: true,
        conversationId: conversationId,
        callerName: activeConversation.name || "Nhóm",
        callerAvatar: activeConversation.avatar || undefined,
        callType: "audio",
        isGroupCall: true,
      });
      return;
    }
    if (!otherUser) return;
    useCallStore.getState().setOutgoingCall({
      isCaller: true,
      toUserId: otherUser.userId,
      conversationId: conversationId,
      callerName: user.fullName || "Người dùng",
      callerAvatar: user.avatarUrl || undefined,
      callType: "audio",
    });
  };

  const handleOpenOtherProfile = () => {
    if (activeConversation?.type === "group" || !otherUser?.userId) return;
    navigate(`/profile/${otherUser.userId}`);
  };

  if (!conversationId || !activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-dark-100">
        <p className="text-gray-500">Chọn một cuộc trò chuyện</p>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 flex flex-col bg-white dark:bg-dark-200 relative ${showInfoPanel ? "xl:pr-[340px]" : ""}`}
    >
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            onClick={() => setActiveConversation(null)}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleOpenOtherProfile}
            disabled={activeConversation.type === "group"}
            className="relative rounded-full disabled:cursor-default"
            title={
              activeConversation.type === "group" ? "" : "Xem trang cá nhân"
            }
          >
            {conversationAvatar ? (
              <img
                src={conversationAvatar}
                alt={conversationName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <span className="text-primary-600 dark:text-primary-400 font-medium">
                  {conversationName?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {otherUser?.status === "online" && (
              <span className="online-indicator" />
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenOtherProfile}
            disabled={activeConversation.type === "group"}
            className="text-left disabled:cursor-default"
            title={
              activeConversation.type === "group" ? "" : "Xem trang cá nhân"
            }
          >
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {conversationName}
              {isMuted && (
                <span className="text-gray-400" title="Đã tắt thông báo">
                  🔕
                </span>
              )}
              {!isOnline && (
                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-normal">
                  <WifiOff className="w-3 h-3" />
                  Offline
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              {!isOnline ? (
                <>
                  <span>Không có kết nối</span>
                  {offlineStatus.pendingCount > 0 && (
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                      {offlineStatus.pendingCount} tin nhắn chờ
                    </span>
                  )}
                </>
              ) : (
                <>
                  {otherUser?.status === "online"
                    ? "Đang hoạt động"
                    : activeConversation.type === "group"
                      ? `${activeConversation.participants.length} thành viên`
                      : "Offline"}
                </>
              )}
            </p>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleStartVoiceCall}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={handleStartVideoCall}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            onClick={handleToggleSearch}
            className={`p-2 rounded-lg text-gray-600 dark:text-gray-400 ${isSearching ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            title={isSearching ? "Đóng tìm kiếm" : "Tìm tin nhắn"}
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowInfoPanel((prev) => !prev)}
            className={`hidden xl:inline-flex p-2 rounded-lg text-gray-600 dark:text-gray-400 ${showInfoPanel ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            title={
              showInfoPanel
                ? "Ẩn thông tin hội thoại"
                : "Hiện thông tin hội thoại"
            }
          >
            <Info className="w-5 h-5" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-300 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 py-1 z-50 animate-scale-in">
                {activeConversation?.type === "group" ? (
                  <button
                    onClick={() => {
                      setShowGroupManagement(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-100 transition-colors"
                  >
                    Quản trị nhóm
                  </button>
                ) : (
                  <button
                    onClick={handleUpdateNickname}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-100 transition-colors"
                  >
                    Đổi tên gợi nhớ
                  </button>
                )}
                <button
                  onClick={() => {
                    handleToggleSearch();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-100 transition-colors"
                >
                  {isSearching ? "Đóng tìm kiếm" : "Tìm tin nhắn"}
                </button>
                <button
                  onClick={async () => {
                    await handleToggleMuteConversation();
                    setShowMenu(false);
                  }}
                  disabled={isMutingConversation}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-100 transition-colors disabled:opacity-50"
                >
                  {isMuted
                    ? "Bật thông báo hội thoại"
                    : "Tắt thông báo hội thoại"}
                </button>
                <button
                  onClick={() => {
                    setShowInfoPanel((prev) => !prev);
                    setShowMenu(false);
                  }}
                  className="hidden xl:block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-100 transition-colors"
                >
                  {showInfoPanel
                    ? "Ẩn thông tin hội thoại"
                    : "Hiện thông tin hội thoại"}
                </button>
                <button
                  onClick={() => {
                    setShowBackgroundPicker(true);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-100 transition-colors"
                >
                  Đổi hình nền
                </button>
                {activeConversation?.type !== "group" && (
                  <button
                    onClick={
                      isBlockedByMe
                        ? handleUnblockUserInConversation
                        : handleBlockUserInConversation
                    }
                    disabled={isBlockingUser}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    {isBlockingUser
                      ? isBlockedByMe
                        ? "Đang mở chặn..."
                        : "Đang chặn..."
                      : isBlockedByMe
                        ? "Mở chặn người dùng"
                        : "Chặn người dùng"}
                  </button>
                )}
                <button
                  onClick={handleDeleteHistory}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-t border-gray-100 dark:border-gray-800"
                >
                  Xóa lịch sử trò chuyện
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {isSearching && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-dark-300 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={searchMessageQuery}
              onChange={(e) => setSearchMessageQuery(e.target.value)}
              placeholder="Nhập từ khóa tìm kiếm..."
              className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-dark-100 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            {searchMessageQuery && (
              <button
                onClick={() => setSearchMessageQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {pinnedMessage && (
        <div className="px-4 py-2 border-b border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <Pin className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Tin nhắn đã ghim
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-100 truncate">
                {pinnedMessage.metadata?.isAnnouncement
                  ? `[Thông báo] ${pinnedMessage.content?.text || ""}`.trim()
                  : pinnedMessage.content?.text ||
                  (pinnedMessage.type === "image"
                    ? "[Hình ảnh]"
                    : pinnedMessage.type === "video"
                      ? "[Video]"
                      : pinnedMessage.type === "voice"
                        ? "[Tin nhắn thoại]"
                        : pinnedMessage.type === "sticker"
                          ? "[Nhãn dán]"
                          : pinnedMessage.content?.fileName
                            ? `[File] ${pinnedMessage.content.fileName}`
                            : "[Tin nhắn]")}
              </p>
            </div>
          </div>

          {canPinMessage && (
            <button
              onClick={handleUnpinMessage}
              disabled={isPinningMessage}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-200 disabled:opacity-50"
            >
              Bỏ ghim
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 relative overflow-hidden flex flex-col"
        style={{
          background:
            !usesImageBackground && conversationBackground
              ? conversationBackground
              : chatAreaBackgroundColor,
        }}
      >
        {/* Custom Background */}
        {usesImageBackground && (
          <div
            className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none"
            style={{ backgroundImage: `url(${conversationBackground})` }}
          >
            <div className="absolute inset-0 bg-white/70 dark:bg-black/70" />
          </div>
        )}

        <VirtualizedMessageList
          isLoading={pagination.isLoading}
          hasMore={pagination.hasMore}
          onReachTop={pagination.loadMore}
          className="relative z-10"
        >
          {(() => {
            const filteredMessages = displayMessages.filter((msg) => {
              if (!debouncedSearchQuery) return true;

              const query = debouncedSearchQuery.toLowerCase();

              if (isPinHistoryMessage(msg)) {
                const bannerText = `${String((msg as any).metadata?.actorName || "")} ${String((msg as any).metadata?.previewText || "")}`.toLowerCase();
                return bannerText.includes(query);
              }

              // Search text messages
              if (msg.type === "text" && msg.content.text) {
                return msg.content.text.toLowerCase().includes(query);
              }

              // Search file names
              if (msg.type === "file" && msg.content.fileName) {
                return msg.content.fileName.toLowerCase().includes(query);
              }

              // Search sticker/image/video content if they have descriptions
              if (
                (msg.type === "sticker" ||
                  msg.type === "image" ||
                  msg.type === "video") &&
                msg.content.text
              ) {
                return msg.content.text.toLowerCase().includes(query);
              }

              return false;
            });

            if (debouncedSearchQuery && filteredMessages.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-10 opacity-60">
                  <Search className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                    Không tìm thấy tin nhắn nào chứa "
                    <span className="font-medium">{debouncedSearchQuery}</span>"
                  </p>
                </div>
              );
            }

            return (
              <>
                {filteredMessages.map((msg, index) => {
                  if (isPinHistoryMessage(msg)) {
                    return <PinHistoryBanner key={msg.id} message={msg} />;
                  }

                  const isSent = msg.senderId === user?.id;
                  const showAvatar =
                    !isSent &&
                    (index === 0 ||
                      isPinHistoryMessage(filteredMessages[index - 1] as any) ||
                      filteredMessages[index - 1].senderId !== msg.senderId);
                  const sender = activeConversation?.participants.find(
                    (p) => String(p.userId) === String(msg.senderId),
                  );

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isSent={isSent}
                      showAvatar={showAvatar}
                      senderName={sender?.fullName}
                      senderAvatar={sender?.avatarUrl ?? undefined}
                      replyMessage={
                        msg.replyTo
                          ? messages.find((m) => m.id === msg.replyTo) || null
                          : null
                      }
                      replySenderName={
                        msg.replyTo
                          ? (() => {
                            const repliedMsg = messages.find(
                              (m) => m.id === msg.replyTo,
                            );
                            if (!repliedMsg) return undefined;
                            const repliedSender =
                              activeConversation?.participants.find(
                                (p) =>
                                  String(p.userId) ===
                                  String(repliedMsg.senderId),
                              );
                            return repliedSender?.fullName;
                          })()
                          : undefined
                      }
                      onReply={() => setReplyTo(msg.id)}
                      onRecall={() => handleRecall(msg.id)}
                      onReact={(emoji) => handleReact(msg.id, emoji)}
                      onForward={() => setForwardMessage(msg)}
                      onPin={() => handlePinMessage(msg.id)}
                      canPin={Boolean(canPinMessage && !msg.isDeleted)}
                      participants={
                        activeConversation?.participants?.map((p) => ({
                          userId: p.userId,
                          fullName: p.fullName,
                        })) ?? []
                      }
                      isGroupChat={activeConversation?.type === "group"}
                      currentUserId={user?.id}
                      onVotePoll={handleVotePoll}
                      onAddPollOption={handleAddPollOption}
                      onRemovePollOption={handleRemovePollOption}
                    />
                  );
                })}

                {typing.length > 0 && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </>
            );
          })()}
        </VirtualizedMessageList>
      </div>

      {/* Reply preview */}
      {replyTo &&
        (() => {
          const repliedMsg = messages.find((m) => m.id === replyTo);
          const repliedSender = repliedMsg
            ? activeConversation?.participants.find(
              (p) => String(p.userId) === String(repliedMsg.senderId),
            )
            : null;
          return (
            <div className="px-4 py-2 bg-gray-50 dark:bg-dark-300 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Reply className="w-4 h-4 text-primary-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-primary-500">
                    {repliedSender?.fullName || "Người dùng"}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {repliedMsg?.content.text || "Tin nhắn"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          );
        })()}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        {isMessagingBlocked && (
          <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-sm flex items-center justify-between gap-3">
            <span className="text-amber-800 dark:text-amber-200">
              {isBlockedByMe ? "Bạn đã chặn người dùng này" : "Bạn đã bị chặn"}
            </span>
            {isBlockedByMe && (
              <button
                type="button"
                onClick={handleUnblockUserInConversation}
                disabled={isBlockingUser}
                className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-100 hover:bg-amber-100/70 dark:hover:bg-amber-800/40 disabled:opacity-50"
              >
                {isBlockingUser ? "Đang mở chặn..." : "Mở chặn"}
              </button>
            )}
          </div>
        )}
        {pendingMediaList.length > 0 && (
          <div className="mb-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-300 p-2.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-primary-600 dark:text-primary-400">
                {pendingMediaList.length} tệp đã chọn — Nhấn gửi để gửi vào đoạn
                chat.
              </p>
              <button
                type="button"
                onClick={clearPendingMedia}
                className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 px-1.5 py-0.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Xóa tất cả"
              >
                <X className="w-3 h-3" />
                Xóa tất cả
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {pendingMediaList.map((media, index) => (
                <div key={index} className="relative group">
                  {media.type === "image" && media.previewUrl && (
                    <img
                      src={media.previewUrl}
                      alt={`Preview ${index + 1}`}
                      className="w-20 h-20 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                    />
                  )}
                  {media.type === "video" && media.previewUrl && (
                    <div className="relative w-20 h-20">
                      <video
                        src={media.previewUrl}
                        className="w-20 h-20 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">▶</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {media.type === "file" && (
                    <div className="w-20 h-20 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex flex-col items-center justify-center text-primary-600 px-1 text-center">
                      <span className="font-semibold text-xs">
                        {media.file.name.split(".").pop()?.toUpperCase() ||
                          "FILE"}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-0.5 truncate w-full">
                        {media.file.name.length > 10
                          ? media.file.name.slice(0, 8) + "..."
                          : media.file.name}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removePendingMediaItem(index)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title="Xóa tệp này"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {dailySummary && (
          <div className="mb-3 rounded-xl border border-primary-200 dark:border-primary-800/50 bg-primary-50 dark:bg-primary-900/20 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-primary-700 dark:text-primary-300 font-medium">
                  Tóm tắt ngày {dailySummary.date} • {dailySummary.messageCount}{" "}
                  tin nhắn
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-200 mt-1 max-h-20 overflow-y-auto pr-1">
                  {dailySummary.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDailySummary(null)}
                className="p-1 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/40 text-primary-700 dark:text-primary-300"
                title="Ẩn tóm tắt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={
                isMessagingBlocked ||
                isSendingMedia ||
                (activeConversation?.type === "group" && !canSendMediaInGroup)
              }
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              title={
                isSendingMedia
                  ? "Đang gửi..."
                  : activeConversation?.type === "group" && !canSendMediaInGroup
                    ? "Bạn không có quyền gửi media"
                    : "Gửi hình ảnh/video"
              }
            >
              {isSendingMedia ? (
                <Loader className="w-5 h-5 animate-spin-fast" />
              ) : (
                <Image className="w-5 h-5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={
                isMessagingBlocked ||
                isSendingMedia ||
                (activeConversation?.type === "group" && !canSendMediaInGroup)
              }
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              title={
                isSendingMedia
                  ? "Đang gửi..."
                  : activeConversation?.type === "group" && !canSendMediaInGroup
                    ? "Bạn không có quyền gửi media"
                    : "Gửi file"
              }
            >
              {isSendingMedia ? (
                <Loader className="w-5 h-5 animate-spin-fast" />
              ) : (
                <Paperclip className="w-5 h-5" />
              )}
            </button>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handlePickImage}
            disabled={
              isMessagingBlocked ||
              isSendingMedia ||
              (activeConversation?.type === "group" && !canSendMediaInGroup)
            }
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handlePickFile}
            disabled={
              isMessagingBlocked ||
              isSendingMedia ||
              (activeConversation?.type === "group" && !canSendMediaInGroup)
            }
          />

          <div className="flex-1 relative" ref={emojiPickerRef}>
            {isRecording ? (
              <div className="w-full flex items-center justify-between px-4 py-2.5 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="font-medium text-sm">Đang thu âm...</span>
                </div>
                <span className="font-mono">
                  {Math.floor(recordingTime / 60)}:
                  {String(recordingTime % 60).padStart(2, "0")}
                </span>
              </div>
            ) : (
              <>
                <textarea
                  ref={inputRef}
                  value={message}
                  disabled={isMessagingBlocked}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      // Trigger form submission manually since it's a textarea now
                      const form = e.currentTarget.closest("form");
                      if (form) form.requestSubmit();
                    }
                  }}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    handleTyping();
                  }}
                  placeholder={
                    isMessagingBlocked
                      ? isBlockedByMe
                        ? "Bạn đã chặn người dùng này"
                        : "Bạn đã bị chặn"
                      : announcementMode
                        ? "Nhập nội dung thông báo..."
                        : "Nhập tin nhắn..."
                  }
                  className={`w-full px-4 py-2.5 bg-gray-100 dark:bg-dark-300 rounded-full
                                        text-gray-900 dark:text-white placeholder-gray-500
                                        focus:outline-none focus:ring-2 ${announcementMode ? "focus:ring-amber-500" : "focus:ring-primary-500"}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {activeConversation?.type === "group" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!canSendAnnouncementInGroup) {
                          addToast(
                            "Bạn không có quyền gửi thông báo trong nhóm này.",
                            "error",
                            3500,
                          );
                          return;
                        }
                        setAnnouncementMode((prev) => !prev);
                      }}
                      disabled={!canSendAnnouncementInGroup}
                      className={`p-1 rounded-full transition-colors ${announcementMode ? "bg-amber-100 text-amber-600" : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"} disabled:opacity-40 disabled:cursor-not-allowed`}
                      title={
                        canSendAnnouncementInGroup
                          ? announcementMode
                            ? "Tắt chế độ thông báo"
                            : "Bật chế độ thông báo"
                          : "Bạn không có quyền gửi thông báo"
                      }
                    >
                      <Megaphone className="w-5 h-5" />
                    </button>
                  )}

                  {activeConversation?.type === "group" && (
                    <button
                      type="button"
                      onClick={() => setShowPollComposer(true)}
                      disabled={isMessagingBlocked}
                      className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-700"
                      title="Tao binh chon"
                    >
                      <BarChart3 className="h-5 w-5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSummarizeConversationInDay}
                    disabled={isSummarizingConversation || !conversationId}
                    className={`p-1 rounded-full transition-colors ${dailySummary
                      ? "bg-primary-100 text-primary-500"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={
                      isSummarizingConversation
                        ? "Đang tóm tắt..."
                        : "Tóm tắt cuộc trò chuyện trong ngày"
                    }
                  >
                    {isSummarizingConversation ? (
                      <Loader className="w-5 h-5 animate-spin-fast" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </button>

                  <div ref={stickerPickerRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowStickerPicker(!showStickerPicker)}
                      disabled={
                        isMessagingBlocked ||
                        (activeConversation?.type === "group" &&
                          !canSendMediaInGroup)
                      }
                      className={`p-1 rounded-full transition-colors ${showStickerPicker
                        ? "bg-primary-100 text-primary-500"
                        : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      title={
                        activeConversation?.type === "group" &&
                          !canSendMediaInGroup
                          ? "Bạn không có quyền gửi media"
                          : "Nhãn dán"
                      }
                    >
                      <Sticker className="w-5 h-5" />
                    </button>

                    {/* Sticker Picker Popup */}
                    {showStickerPicker && (
                      <div className="absolute bottom-full right-0 mb-2 z-50">
                        <StickerPicker onSelect={handleSendSticker} />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    disabled={isMessagingBlocked}
                    className={`p-1 rounded-full transition-colors ${showEmojiPicker
                      ? "bg-primary-100 text-primary-500"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <SmileIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Emoji Picker Popup */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2 z-50">
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      theme={
                        document.documentElement.classList.contains("dark")
                          ? Theme.DARK
                          : Theme.LIGHT
                      }
                      width={350}
                      height={400}
                      searchPlaceHolder="Tìm emoji..."
                      previewConfig={{ showPreview: false }}
                      lazyLoadEmojis={true}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {(message.trim() || pendingMediaList.length > 0) && !isRecording ? (
            <button
              type="submit"
              disabled={isMessagingBlocked}
              className="p-3 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleRecord}
              disabled={
                isMessagingBlocked ||
                (activeConversation?.type === "group" && !canSendMediaInGroup)
              }
              className={`p-3 text-white rounded-full transition-all flex-shrink-0
                                ${isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-primary-500 hover:bg-primary-600"} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRecording ? (
                <Square className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          )}
        </form>
      </div>

      {showInfoPanel && (
        <aside className="hidden xl:flex absolute inset-y-0 right-0 w-[340px] flex-col border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-dark-300">
          <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Thông tin hội thoại
            </h3>
            <button
              onClick={() => setShowInfoPanel(false)}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500"
              title="Ẩn thông tin hội thoại"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="rounded-2xl bg-white dark:bg-dark-200 border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex flex-col items-center text-center">
                {conversationAvatar ? (
                  <button
                    type="button"
                    onClick={handleOpenOtherProfile}
                    disabled={activeConversation.type === "group"}
                    className="rounded-full disabled:cursor-default"
                    title={
                      activeConversation.type === "group"
                        ? ""
                        : "Xem trang cá nhân"
                    }
                  >
                    <img
                      src={conversationAvatar}
                      alt={conversationName}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenOtherProfile}
                    disabled={activeConversation.type === "group"}
                    className="rounded-full disabled:cursor-default"
                    title={
                      activeConversation.type === "group"
                        ? ""
                        : "Xem trang cá nhân"
                    }
                  >
                    <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <span className="text-2xl font-semibold text-primary-600 dark:text-primary-300">
                        {conversationName?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenOtherProfile}
                  disabled={activeConversation.type === "group"}
                  className="mt-3 font-semibold text-gray-900 dark:text-white disabled:cursor-default"
                  title={
                    activeConversation.type === "group"
                      ? ""
                      : "Xem trang cá nhân"
                  }
                >
                  {conversationName}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {activeConversation.type === "group"
                    ? `${activeConversation.participants.length} thành viên`
                    : otherUser?.status === "online"
                      ? "Đang hoạt động"
                      : "Trò chuyện riêng tư"}
                </p>
              </div>

              <div
                className={`mt-4 grid gap-2 ${activeConversation.type === "group" ? "grid-cols-2" : "grid-cols-3"}`}
              >
                <button
                  type="button"
                  onClick={handleToggleSearch}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-100 transition-colors"
                >
                  {isSearching ? "Đóng tìm kiếm" : "Tìm tin nhắn"}
                </button>
                <button
                  type="button"
                  onClick={handleToggleMuteConversation}
                  disabled={isMutingConversation}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-100 transition-colors disabled:opacity-50"
                >
                  {isMuted ? "Bật thông báo" : "Tắt thông báo"}
                </button>
                {activeConversation.type !== "group" && (
                  <button
                    type="button"
                    onClick={
                      isBlockedByMe
                        ? handleUnblockUserInConversation
                        : handleBlockUserInConversation
                    }
                    disabled={isBlockingUser}
                    className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-800/60 text-sm text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    {isBlockingUser
                      ? isBlockedByMe
                        ? "Đang mở chặn..."
                        : "Đang chặn..."
                      : isBlockedByMe
                        ? "Mở chặn"
                        : "Chặn"}
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-dark-200 border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
              <button
                type="button"
                className="w-full px-3 py-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300">
                    <Clock3 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Nhắc hẹn
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      Tạo lời nhắc trong đoạn chat
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                className="w-full px-3 py-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-300">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Nhóm chat chung
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {activeConversation.type === "group"
                        ? "Cuộc trò chuyện nhóm hiện tại"
                        : `${commonGroupCount} nhóm chung`}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="rounded-2xl bg-white dark:bg-dark-200 border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleInfoSection("media")}
                className="w-full px-3 py-3 flex items-center justify-between text-left border-b border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary-500" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Ảnh/Video
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({sharedMedia.length})
                  </span>
                </div>
                {expandedInfoSections.media ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedInfoSections.media && (
                <div className="px-3 py-3">
                  {visibleMedia.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Chưa có ảnh hoặc video được chia sẻ.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {visibleMedia.map((mediaItem) => (
                        <a
                          key={mediaItem.id}
                          href={mediaItem.url}
                          target="_blank"
                          rel="noreferrer"
                          className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-100 group"
                          title={`${mediaItem.senderName} • ${formatPanelDate(mediaItem.createdAt)}`}
                        >
                          {mediaItem.type === "image" ? (
                            <img
                              src={mediaItem.url}
                              alt="Media"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={mediaItem.url}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                          )}
                          {mediaItem.type === "video" && (
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-black/70 text-white">
                              Video
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}

                  {sharedMedia.length > 6 && (
                    <button
                      type="button"
                      onClick={() => toggleShowAllInfoItems("media")}
                      className="mt-3 text-xs font-medium text-primary-600 dark:text-primary-300 hover:underline"
                    >
                      {showAllInfoItems.media ? "Thu gọn" : "Xem tất cả"}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white dark:bg-dark-200 border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleInfoSection("files")}
                className="w-full px-3 py-3 flex items-center justify-between text-left border-b border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-500" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    File
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({sharedFiles.length})
                  </span>
                </div>
                {expandedInfoSections.files ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedInfoSections.files && (
                <div className="px-3 py-2 space-y-2">
                  {visibleFiles.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 py-1">
                      Chưa có tệp được chia sẻ.
                    </p>
                  ) : (
                    visibleFiles.map((fileItem) => {
                      const extension =
                        fileItem.name.split(".").pop()?.toUpperCase() || "FILE";
                      const fileMeta = [
                        formatPanelDate(fileItem.createdAt),
                        formatPanelFileSize(fileItem.size),
                        fileItem.senderName,
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <div
                          key={fileItem.id}
                          className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-dark-100"
                        >
                          <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-[10px] font-semibold text-primary-600 dark:text-primary-300">
                            {extension}
                          </div>
                          <div className="min-w-0 flex-1">
                            {fileItem.url ? (
                              <a
                                href={fileItem.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-300 truncate block"
                                title={fileItem.name}
                              >
                                {fileItem.name}
                              </a>
                            ) : (
                              <p
                                className="text-sm text-gray-900 dark:text-white truncate"
                                title={fileItem.name}
                              >
                                {fileItem.name}
                              </p>
                            )}
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                              {fileMeta}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {sharedFiles.length > 4 && (
                    <button
                      type="button"
                      onClick={() => toggleShowAllInfoItems("files")}
                      className="text-xs font-medium text-primary-600 dark:text-primary-300 hover:underline"
                    >
                      {showAllInfoItems.files ? "Thu gọn" : "Xem tất cả"}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white dark:bg-dark-200 border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleInfoSection("links")}
                className="w-full px-3 py-3 flex items-center justify-between text-left border-b border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary-500" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Link
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({sharedLinks.length})
                  </span>
                </div>
                {expandedInfoSections.links ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedInfoSections.links && (
                <div className="px-3 py-2 space-y-2">
                  {visibleLinks.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 py-1">
                      Chưa có liên kết được chia sẻ.
                    </p>
                  ) : (
                    visibleLinks.map((linkItem) => (
                      <a
                        key={linkItem.id}
                        href={linkItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-gray-50 dark:hover:bg-dark-100"
                        title={linkItem.url}
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300 mt-0.5">
                          <Link2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 dark:text-white truncate">
                            {linkItem.url}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {`${linkItem.host} • ${formatPanelDate(linkItem.createdAt)} • ${linkItem.senderName}`}
                          </p>
                        </div>
                      </a>
                    ))
                  )}

                  {sharedLinks.length > 4 && (
                    <button
                      type="button"
                      onClick={() => toggleShowAllInfoItems("links")}
                      className="text-xs font-medium text-primary-600 dark:text-primary-300 hover:underline"
                    >
                      {showAllInfoItems.links ? "Thu gọn" : "Xem tất cả"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      <GroupManagementModal
        isOpen={showGroupManagement}
        onClose={() => setShowGroupManagement(false)}
        group={activeConversation}
      />

      <PollComposerModal
        open={showPollComposer}
        onClose={() => setShowPollComposer(false)}
        onSubmit={handleSubmitPoll}
        canPinInConversation={Boolean(canPinMessage)}
        conversationName={activeConversation?.name}
      />

      <ForwardMessageModal
        isOpen={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
        onForward={handleForwardSend}
      />

      {showBackgroundPicker && (
        <BackgroundPickerModal
          currentBackground={activeConversation?.background}
          onApply={handleUpdateBackground}
          onClose={() => setShowBackgroundPicker(false)}
        />
      )}
    </div>
  );
}
