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

interface ForgotPasswordResponse {
  message: string;
  expiresIn: number;
}

interface RegisterData {
  email: string;
  password: string;
  userName: string;
  phone: string;
  gender: string;
  birthday: string;
  avartarUrl: string;
  status?: string;
}

interface UploadResponse {
  url: string;
  fileName: string;
  fileSize: number;
  mimetype: string;
}

// Map server user shape to mobile User type
const mapServerUser = (u: ServerUser): User => ({
  id: u.userId,
  email: u.email,
  phone: u.phone,
  fullName: u.userName,
  avatarUrl: u.avartarUrl,
  birthday: u.birthday,
  gender: u.gender,
  bio: null,
  status: u.status === "active" ? "online" : "offline",
  lastSeen: null,
  createdAt: u.createdAt,
});

class UserService {
  // POST /api/users/login - đăng nhập
  async login(email: string, password: string): Promise<LoginResponse> {
      console.log(email, password);
    const response = await apiClient.post<{ user: ServerUser; accessToken: string; refreshToken: string }>(
      "/api/users/login",
      { email, password },
    );
    const { user, accessToken, refreshToken } = response.data;
    console.log(email, password);
    return { user: mapServerUser(user), accessToken, refreshToken };
  }

  // POST /api/users/register - đăng ký
  async register(data: RegisterData): Promise<User> {
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

  async uploadAvatar(fileUri: string): Promise<string> {
    const formData = new FormData();
    const fileName = fileUri.split("/").pop() || `avatar-${Date.now()}.jpg`;
    const fileExtension = fileName.split(".").pop()?.toLowerCase();
    const mimeType =
      fileExtension === "png"
        ? "image/png"
        : fileExtension === "gif"
          ? "image/gif"
          : "image/jpeg";

    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);

    const response = await apiClient.post<UploadResponse>("/api/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data.url;
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

  async requestForgotPasswordOtp(email: string): Promise<ForgotPasswordResponse> {
    const response = await apiClient.post<ForgotPasswordResponse>(
      "/api/users/forgot-password/request-otp",
      { email },
    );
    return response.data;
  }

  async verifyForgotPasswordOtp(email: string, otp: string): Promise<ForgotPasswordResponse> {
    const response = await apiClient.post<ForgotPasswordResponse>(
      "/api/users/forgot-password/verify-otp",
      { email, otp },
    );
    return response.data;
  }

  async resetForgotPassword(email: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      "/api/users/forgot-password/reset",
      { email, newPassword },
    );
    return response.data;
  }
}

export const userService = new UserService();
