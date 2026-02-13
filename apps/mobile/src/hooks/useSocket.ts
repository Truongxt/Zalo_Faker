import { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { socketService } from "@/lib/socket";
import { useChatStore } from "@/stores/chatStore";
import type { Message } from "@/types";

/**
 * Hook to manage Socket.io connection lifecycle.
 * Connects on mount, handles AppState (background/foreground), disconnects on unmount.
 */
export function useSocket() {
  const socketRef = useRef(socketService);

  useEffect(() => {
    const socket = socketRef.current;
    socket.connect();

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
      socket.disconnect();
    };
  }, []);

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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const sendTyping = useCallback(() => {
    socketService.sendTyping(conversationId);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      socketService.stopTyping(conversationId);
    }, 2000);
  }, [conversationId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return sendTyping;
}
