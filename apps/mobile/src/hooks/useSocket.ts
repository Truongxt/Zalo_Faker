import { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus, Alert } from "react-native";
import { socketService } from "@/lib/socket";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import type { Message } from "@/types";

/**
 * Hook to manage Socket.io connection lifecycle.
 * Connects on mount, handles AppState (background/foreground),
 * handles force logout when another device logs in, and disconnects on unmount.
 */
export function useSocket() {
  const socketRef = useRef(socketService);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const socket = socketRef.current;
    socket.connect();

    // ── Force logout: another device logged in on same platform ──
    const handleForceLogout = (data: { reason: string; platform: string }) => {
      socket.disconnect();
      logout();
      Alert.alert(
        "Phiên đăng nhập đã kết thúc",
        data.reason || "Tài khoản của bạn đã được đăng nhập trên thiết bị khác.",
        [{ text: "OK" }]
      );
    };
    socketService.on("session:force_logout", handleForceLogout);

    // ── App State handling ──
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active") {
        socket.connect();
      } else if (state === "background") {
        // Keep alive for a bit, then disconnect
        setTimeout(() => {
          if (AppState.currentState !== "active") {
            socket.disconnect();
          }
        }, 30_000);
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);

    return () => {
      sub.remove();
      socketService.off("session:force_logout", handleForceLogout);
      socket.disconnect();
    };
  }, [logout]);

  return socketRef.current;
}

/**
 * Hook to listen for new incoming messages in real-time.
 */
export function useMessageListener(conversationId?: string) {
  const addMessage = useChatStore((s) => s.addMessage);

  useEffect(() => {
    const handler = (message: Message) => {
      if (!conversationId || message.conversationId === conversationId) {
        addMessage(message.conversationId, message);
      }
    };

    socketService.on("chat:message", handler);
    return () => {
      socketService.off("chat:message", handler);
    };
  }, [conversationId, addMessage]);
}

/**
 * Debounced typing indicator hook.
 */
export function useTypingIndicator(conversationId: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendTyping = useCallback(() => {
    socketService.emit("chat:typing", { conversationId });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      socketService.emit("chat:stop_typing", { conversationId });
    }, 2000);
  }, [conversationId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return sendTyping;
}

/**
 * Hook to track online/offline status of users.
 * Returns a Map<userId, boolean> of online statuses.
 */
export function usePresence() {
  const onlineUsersRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    const handleOnline = ({ userId }: { userId: string }) => {
      onlineUsersRef.current.set(userId, true);
    };
    const handleOffline = ({ userId }: { userId: string }) => {
      onlineUsersRef.current.set(userId, false);
    };

    socketService.on("presence:online", handleOnline);
    socketService.on("presence:offline", handleOffline);

    return () => {
      socketService.off("presence:online", handleOnline);
      socketService.off("presence:offline", handleOffline);
    };
  }, []);

  /**
   * Query the server for the online status of specific users.
   */
  const fetchOnlineStatuses = useCallback((userIds: string[]) => {
    return new Promise<Record<string, boolean>>((resolve, reject) => {
      socketService.emit(
        "presence:get_online_users",
        userIds,
        (response: { success: boolean; onlineStatuses?: Record<string, boolean>; error?: string }) => {
          if (response.success && response.onlineStatuses) {
            // Update local cache
            for (const [uid, isOnline] of Object.entries(response.onlineStatuses)) {
              onlineUsersRef.current.set(uid, isOnline);
            }
            resolve(response.onlineStatuses);
          } else {
            reject(new Error(response.error || "Failed to fetch online statuses"));
          }
        }
      );
    });
  }, []);

  return {
    onlineUsers: onlineUsersRef.current,
    fetchOnlineStatuses,
  };
}
