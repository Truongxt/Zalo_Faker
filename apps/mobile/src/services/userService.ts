import apiClient from "./apiClient";
import type { User } from "@/types";

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Raw user shape returned from server
interface ServerUser {
  userId: string;
  email: string;
  phone: string;
  userName: string;
  avartarUrl: string | null;
  birthday: string | null;
  gender: string;
  status: string;
  createdAt: string;
}

interface UpdateUserData {
  userName?: string;
  phone?: string;
  avartarUrl?: string;
  birthday?: string;
  gender?: string;
  password?: string;
  status?: string;
}

// Map server user shape to mobile User type
const mapServerUser = (u: ServerUser): User => ({
  id: u.userId,
  email: u.email,
  phone: u.phone,
  fullName: u.userName,
  avatarUrl: u.avartarUrl,
  bio: null,
  status: u.status === "active" ? "online" : "offline",
  lastSeen: null,
  createdAt: u.createdAt,
});

class UserService {
  // POST /api/users/login - đăng nhập
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<{ user: ServerUser; accessToken: string; refreshToken: string }>(
      "/api/users/login",
      { email, password },
    );
    const { user, accessToken, refreshToken } = response.data;
    return { user: mapServerUser(user), accessToken, refreshToken };
  }

  // POST /api/users/register - đăng ký
  async register(data: { email: string; password: string; userName: string; phone?: string }): Promise<User> {
    const response = await apiClient.post<ServerUser>("/api/users/register", data);
    return mapServerUser(response.data);
  }

  // POST /api/users/logout - đăng xuất
  async logout(refreshToken: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>("/api/users/logout", { refreshToken });
    return response.data;
  }

  // GET /api/users/ - lấy danh sách tất cả users (cần auth)
  async getUsers(): Promise<User[]> {
    const response = await apiClient.get<ServerUser[]>("/api/users/");
    return response.data.map(mapServerUser);
  }

  // PUT /api/users/:userId - cập nhật thông tin user (cần auth)
  async updateUser(userId: string, data: UpdateUserData): Promise<User> {
    const response = await apiClient.put<ServerUser>(`/api/users/${userId}`, data);
    return mapServerUser(response.data);
  }

  // DELETE /api/users/:userId - xóa user (cần auth)
  async deleteUser(userId: string): Promise<{ userId: string }> {
    const response = await apiClient.delete<{ userId: string }>(`/api/users/${userId}`);
    return response.data;
  }

  async getUserByPhone(phone: string): Promise<User> {
    const response = await apiClient.get<ServerUser>(`/api/users/phone/${phone}`);
    console.log("response ", response.data);
    return mapServerUser(response.data);
  }
  async getUserById(id: string): Promise<User> {
    const response = await apiClient.get<ServerUser>(`/api/users/id/${id}`);
    return mapServerUser(response.data);
  }
}

export const userService = new UserService();
