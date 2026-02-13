import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/authStore";
import { SOCKET_URL } from "@/constants/config";

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): Socket | undefined {
    const { accessToken } = useAuthStore.getState();

    if (this.socket?.connected) return this.socket;

    this.socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log("[Socket] Connected");
      this.reconnectAttempts = 0;
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
      this.reconnectAttempts++;
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.reconnectAttempts = 0;
    }
  }

  getSocket(): Socket | undefined {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  emit(event: string, ...args: any[]) {
    this.socket?.emit(event, ...args);
  }

  // Convenience: join a conversation room
  joinConversation(conversationId: string) {
    this.emit("join_conversation", { conversationId });
  }

  leaveConversation(conversationId: string) {
    this.emit("leave_conversation", { conversationId });
  }

  sendTyping(conversationId: string) {
    this.emit("typing", { conversationId });
  }

  stopTyping(conversationId: string) {
    this.emit("stop_typing", { conversationId });
  }
}

export const socketService = new SocketService();
export default socketService;
