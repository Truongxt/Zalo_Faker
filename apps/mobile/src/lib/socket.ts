import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/authStore";
import { SOCKET_URL } from "@/constants/config";
class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private joinedRooms = new Set<string>();

  connect() {
    const { accessToken } = useAuthStore.getState();

    if (this.socket?.connected) return this.socket;
    if (this.socket && !this.socket.connected) {
      this.socket.auth = { token: accessToken, platform: "mobile" };
      this.socket.connect();
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token: accessToken, platform: "mobile" },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log("Socket connected");
      this.reconnectAttempts = 0;
      this.joinedRooms.forEach((conversationId) => {
        this.socket?.emit("room:join", conversationId);
      });
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error?.message || error);
      this.reconnectAttempts++;
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.joinedRooms.clear();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(conversationId: string) {
    this.joinedRooms.add(conversationId);
    this.socket?.emit("room:join", conversationId);
  }

  leaveRoom(conversationId: string) {
    this.joinedRooms.delete(conversationId);
    this.socket?.emit("room:leave", conversationId);
  }

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
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
}

export const socketService = new SocketService();
export default socketService;
