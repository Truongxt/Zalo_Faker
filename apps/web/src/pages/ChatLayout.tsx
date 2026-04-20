import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import { useChatStore, normalizeMessage } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { getConversation } from "@/services/api";
import { socketService } from "@/lib/socket";
import { getMessagePreviewText } from "@/lib/messagePreview";
import IncomingCallModal from "@/components/chat/IncomingCallModal";
import VideoCallModal from "@/components/chat/VideoCallModal";
import GroupCallModal from "@/components/chat/GroupCallModal";
import GroupCallIncomingModal from "@/components/chat/GroupCallIncomingModal";
import { useCallStore } from "@/stores/callStore";

const SIDEBAR_WIDTH_STORAGE_KEY = "chat-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_CONTENT_WIDTH = 180;
const RESIZABLE_BREAKPOINT = 540;
const CONVERSATION_SYNC_COOLDOWN_MS = 15_000;

const getStoredSidebarWidth = () => {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;

  const storedWidth = Number(
    window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY),
  );
  return Number.isFinite(storedWidth) ? storedWidth : DEFAULT_SIDEBAR_WIDTH;
};

const clampSidebarWidth = (width: number, viewportWidth: number) => {
  const maxAllowedWidth = Math.min(
    MAX_SIDEBAR_WIDTH,
    Math.max(MIN_SIDEBAR_WIDTH, viewportWidth - MIN_CONTENT_WIDTH),
  );

  return Math.min(maxAllowedWidth, Math.max(MIN_SIDEBAR_WIDTH, width));
};

export default function ChatLayout() {
  const {
    setConversations,
    addMessage,
    updateMessage,
    updateConversation,
    setLastSyncedAt,
  } = useChatStore();
  const { user } = useAuthStore();
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clampSidebarWidth(
      getStoredSidebarWidth(),
      typeof window === "undefined"
        ? DEFAULT_SIDEBAR_WIDTH + MIN_CONTENT_WIDTH
        : window.innerWidth,
    ),
  );
  const [canResizeSidebar, setCanResizeSidebar] = useState(
    () =>
      typeof window !== "undefined" &&
      window.innerWidth >= RESIZABLE_BREAKPOINT,
  );
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { conversations: cachedConversations, lastSyncedAt } =
        useChatStore.getState();

      if (cachedConversations.length > 0) {
        socketService.joinRooms(cachedConversations.map((c) => c.id));
      }

      const shouldFetch =
        cachedConversations.length === 0 ||
        !lastSyncedAt ||
        Date.now() - lastSyncedAt > CONVERSATION_SYNC_COOLDOWN_MS;

      if (!shouldFetch) return;

      try {
        const convs = await getConversation();
        setConversations(convs);
        setLastSyncedAt(Date.now());

        if (convs && convs.length > 0) {
          const roomIds = convs.map((c: any) => c.id);
          socketService.joinRooms(roomIds);
        }
      } catch (error) {
        console.error("Error loading conversations:", error);
      }
    };

    loadData();

    if (user?.id) {
      socketService.connect(user.id);

      const handleIncomingCall = (data: any) => {
        const { setIncomingCall } = useCallStore.getState();
        setIncomingCall(data);
      };
      const handleCallEnded = () => {
        const { clearCall } = useCallStore.getState();
        clearCall();
      };
      const handleCallRejected = () => {
        const { clearCall } = useCallStore.getState();
        clearCall();
      };

      const handleNewMessageGlobal = (msg: any) => {
        console.log("[socket] received new message:", msg);
        const normalizedMsg = normalizeMessage(msg);
        const conversationId = normalizedMsg.conversationId;
        const store = useChatStore.getState();
        const activeConversationId = store.activeConversation?.id;

        const existing = store.messages[conversationId] || [];
        const isDuplicate = existing.some((m) => m.id === normalizedMsg.id);

        if (!isDuplicate) {
          addMessage(conversationId, normalizedMsg);
          console.log("[socket] added message to store:", normalizedMsg.id);
        } else {
          console.log("[socket] duplicate message ignored:", normalizedMsg.id);
          return;
        }

        const currentConv = store.conversations.find(
          (c) => c.id === conversationId,
        );
        let newUnreadCount = 0;

        if (activeConversationId !== conversationId) {
          newUnreadCount = (currentConv?.unreadCount || 0) + 1;
        }

        updateConversation(conversationId, {
          lastMessage: {
            content: getMessagePreviewText({
              type: normalizedMsg.type,
              content: normalizedMsg.content,
              metadata: normalizedMsg.metadata,
            }),
            type: normalizedMsg.type,
            senderId: normalizedMsg.senderId,
            timestamp: normalizedMsg.createdAt,
            metadata: normalizedMsg.metadata,
          },
          updatedAt: normalizedMsg.createdAt,
          unreadCount: newUnreadCount,
        });
      };

      const handleRecalledGlobal = (data: {
        messageId: string;
        conversationId: string;
      }) => {
        console.log("[socket] message recalled:", data);
        updateMessage(data.conversationId, data.messageId, { isDeleted: true });
      };

      const handleReactionGlobal = (data: {
        messageId: string;
        conversationId: string;
        reactions: any[];
      }) => {
        console.log("[socket] reaction update:", data);
        updateMessage(data.conversationId, data.messageId, {
          reactions: data.reactions,
        });
      };

      const handlePinnedMessageGlobal = (data: {
        conversationId: string;
        pinnedMessage: any | null;
      }) => {
        if (!data?.conversationId) return;

        const store = useChatStore.getState();
        const conversation = store.conversations.find(
          (c) => c.id === data.conversationId,
        );
        if (!conversation) return;

        updateConversation(data.conversationId, {
          groupSettings: {
            ...(conversation.groupSettings || {
              invite: { code: "", approvalRequired: true },
              joinRequests: [],
              permissions: {
                sendMedia: "all",
                pinMessage: conversation.type === "group" ? "admin_deputy" : "all",
                sendAnnouncement:
                  conversation.type === "group" ? "admin_deputy" : "all",
              },
            }),
            pinnedMessage: data.pinnedMessage || null,
          },
        });
      };

      const handleMessageUpdatedGlobal = (data: {
        conversationId: string;
        message: any;
      }) => {
        if (!data?.conversationId || !data?.message) return;
        const normalized = normalizeMessage(data.message);
        updateMessage(data.conversationId, String(normalized.id), normalized);
      };

      const handleIncomingGroupCall = (data: any) => {
        // Don't show if we're already in a group call
        const currentGroupCall = useCallStore.getState().groupCall;
        if (currentGroupCall.callStatus !== 'idle') return;

        useCallStore.getState().setIncomingGroupCall({
          roomId: data.roomId,
          conversationId: data.conversationId,
          callType: data.callType || 'audio',
          callerName: data.callerName || 'Cuộc gọi nhóm',
          callerAvatar: data.callerAvatar || null,
          hostUserId: data.hostUserId,
          participantCount: data.participantCount || 0,
        });
      };

      const socket = socketService.getSocket();
      if (socket) {
        console.log("[socket] attaching global listeners:", socket.id);
        socket.on("video:incoming-call", handleIncomingCall);
        socket.on("video:call-ended", handleCallEnded);
        socket.on("video:call-rejected", handleCallRejected);
        socket.on("group:incoming", handleIncomingGroupCall);
        socket.on("chat:message", handleNewMessageGlobal);
        socket.on("chat:recalled", handleRecalledGlobal);
        socket.on("chat:reaction", handleReactionGlobal);
        socket.on("chat:pinned_message", handlePinnedMessageGlobal);
        socket.on("chat:message_updated", handleMessageUpdatedGlobal);
      }
    }

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off("video:incoming-call");
        socket.off("video:call-ended");
        socket.off("video:call-rejected");
        socket.off("group:incoming");
        socket.off("chat:message");
        socket.off("chat:recalled");
        socket.off("chat:reaction");
        socket.off("chat:pinned_message");
        socket.off("chat:message_updated");
      }
    };
  }, [
    user?.id,
    setConversations,
    addMessage,
    updateMessage,
    updateConversation,
    setLastSyncedAt,
  ]);

  useEffect(() => {
    const syncSidebarLayout = () => {
      const viewportWidth = window.innerWidth;
      setCanResizeSidebar(viewportWidth >= RESIZABLE_BREAKPOINT);
      setSidebarWidth((currentWidth) =>
        clampSidebarWidth(currentWidth, viewportWidth),
      );
    };

    syncSidebarLayout();
    window.addEventListener("resize", syncSidebarLayout);

    return () => window.removeEventListener("resize", syncSidebarLayout);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_WIDTH_STORAGE_KEY,
      String(sidebarWidth),
    );
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current) return;

      const nextWidth =
        dragStateRef.current.startWidth +
        (event.clientX - dragStateRef.current.startX);
      setSidebarWidth(clampSidebarWidth(nextWidth, window.innerWidth));
    };

    const stopResizing = () => {
      dragStateRef.current = null;
      setIsResizingSidebar(false);
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isResizingSidebar]);

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canResizeSidebar) return;

    dragStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    setIsResizingSidebar(true);
    event.preventDefault();
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-gray-50 dark:bg-dark-100">
      <div
        className="relative h-full flex-shrink-0"
        style={{ width: `${sidebarWidth}px` }}
      >
        <Sidebar />

        {canResizeSidebar && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat sidebar"
            title="Keo de doi chieu rong"
            onPointerDown={handleResizeStart}
            onDoubleClick={() =>
              setSidebarWidth(
                clampSidebarWidth(DEFAULT_SIDEBAR_WIDTH, window.innerWidth),
              )
            }
            className="group absolute right-0 top-0 z-10 flex h-full w-3 translate-x-1/2 cursor-col-resize touch-none items-center justify-center"
          >
            <span
              className={`h-20 w-1 rounded-full transition-colors ${
                isResizingSidebar
                  ? "bg-primary-400"
                  : "bg-gray-200 group-hover:bg-primary-300"
              }`}
            />
          </div>
        )}
      </div>

      <div className="flex h-full min-w-0 flex-1">
        <Outlet />
      </div>

      <IncomingCallModal />
      <VideoCallModal />
      <GroupCallModal />
      <GroupCallIncomingModal />
    </div>
  );
}
