import apiClient from "./apiClient";
import { Platform } from "react-native";
import { API_URL, STORAGE_KEYS } from "@/constants/config";
import type {
  User,
  ServerUser,
  LoginResponse,
  UpdateUserData,
  RegisterData,
  ForgotPasswordResponse,
  UploadResponse,
  LoginHistoryItem
} from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/stores/authStore";

export type { LoginResponse };

const getMimeTypeFromUri = (fileUri: string) => {
  const cleanUri = fileUri.split("?")[0];
  const fileName = cleanUri.split("/").pop() || "avatar.jpg";
  const fileExtension = fileName.split(".").pop()?.toLowerCase();

  const mimeType =
    fileExtension === "png"
      ? "image/png"
      : fileExtension === "gif"
        ? "image/gif"
        : fileExtension === "webp"
          ? "image/webp"
          : "image/jpeg";

  return { fileName, mimeType };
};




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
  status: (u.presenceStatus === "online" || u.presenceStatus === "offline")
    ? u.presenceStatus
    : (u.status === "active" ? "online" : "offline"),
  lastSeen: u.lastActiveAt ?? null,
  createdAt: u.createdAt,
});

class UserService {
  // Helper: Build FormData with user data + avatar file
  private buildFormDataWithFile(data: UpdateUserData, avatarFileUri: string): FormData {
    const formData = new FormData();

    // Add user info fields
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    // Add avatar file
    const { fileName, mimeType } = getMimeTypeFromUri(avatarFileUri);
    formData.append("file", {
      uri: avatarFileUri,
      name: fileName,
      type: mimeType,
    } as any);

    return formData;
  }

  // POST /api/users/login - đăng nhập
  async login(email: string, password: string): Promise<LoginResponse> {
    console.log(email, password);

    const deviceInfo = `${Platform.OS} ${Platform.Version}`;

    const response = await apiClient.post<{ user: ServerUser; accessToken: string; refreshToken: string }>(
      "/api/users/login",
      { email, password, platform: "mobile", deviceInfo },
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

  // PUT /api/users/:userId - Cập nhật user (với hoặc không có avatar)
  async updateUser(
    userId: string,
    data: UpdateUserData,
    avatarFileUri?: string,
  ): Promise<User> {
    // Không có avatar → gửi JSON bình thường
    if (!avatarFileUri) {
      const response = await apiClient.put<ServerUser>(`/api/users/${userId}`, data);
      return mapServerUser(response.data);
    }

    // Có avatar → dùng fetch (Axios không hỗ trợ file URI trên React Native)
    try {
      // 1. Lấy token
      let token: string | null = null;
      try { token = useAuthStore.getState().accessToken; } catch (_) { }
      if (!token) token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (!token) {
        try {
          const p = await AsyncStorage.getItem("auth-storage");
          if (p) token = JSON.parse(p)?.state?.accessToken ?? null;
        } catch (_) { }
      }

      // 2. Build FormData
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      const { fileName, mimeType } = getMimeTypeFromUri(avatarFileUri);
      formData.append("file", {
        uri: avatarFileUri,
        name: fileName,
        type: mimeType,
      } as any);

      // 3. Gửi bằng fetch — KHÔNG dùng Axios, KHÔNG set Content-Type
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Upload failed: ${res.status} ${errText}`);
      }

      const serverUser: ServerUser = await res.json();
      return mapServerUser(serverUser);
    } catch (error) {
      console.error("[userService] Avatar upload failed:", error);
      throw error;
    }
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

  // POST /api/users/:userId/change-password - đổi mật khẩu
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<{ message: string; user: User }> {
    const response = await apiClient.post<{ message: string; user: ServerUser }>(
      `/api/users/${userId}/change-password`,
      { oldPassword, newPassword },
    );
    return { message: response.data.message, user: mapServerUser(response.data.user) };
  }

  // POST /api/users/:userId/lock-account - khóa tài khoản (yêu cầu xác thực mật khẩu)
  async lockAccount(userId: string, currentPassword: string): Promise<{ message: string; user: User }> {
    const response = await apiClient.post<{ message: string; user: ServerUser }>(
      `/api/users/${userId}/lock-account`,
      { currentPassword },
    );
    return { message: response.data.message, user: mapServerUser(response.data.user) };
  }

  // POST /api/users/:userId/lock-account/request-otp - gửi OTP khóa vĩnh viễn
  async requestPermanentLockOtp(userId: string): Promise<{ message: string; expiresIn: number }> {
    const response = await apiClient.post<{ message: string; expiresIn: number }>(
      `/api/users/${userId}/lock-account/request-otp`,
    );
    return response.data;
  }

  // POST /api/users/:userId/lock-account/permanent - khóa vĩnh viễn (không thể khôi phục)
  async permanentLockAccount(
    userId: string,
    password: string,
    otp: string,
    confirmIrreversible: boolean,
  ): Promise<{ message: string; user: User }> {
    const response = await apiClient.post<{ message: string; user: ServerUser }>(
      `/api/users/${userId}/lock-account/permanent`,
      { password, otp, confirmIrreversible },
    );
    return { message: response.data.message, user: mapServerUser(response.data.user) };
  }

  // POST /api/users/unlock-account - mở khóa tài khoản
  async unlockAccount(email: string, password: string): Promise<{ message: string; user: User }> {
    const response = await apiClient.post<{ message: string; user: ServerUser }>(
      "/api/users/unlock-account",
      { email, password },
    );
    return { message: response.data.message, user: mapServerUser(response.data.user) };
  }

  // POST /api/users/register/request-otp - gửi OTP khi đăng ký
  async registerRequestOtp(email: string): Promise<{ message: string; expiresIn: number }> {
    const response = await apiClient.post<{ message: string; expiresIn: number }>(
      "/api/users/register/request-otp",
      { email },
    );
    return response.data;
  }

  // POST /api/users/register/verify-otp - xác thực OTP đăng ký
  async registerVerifyOtp(email: string, otp: string): Promise<{ message: string; expiresIn: number }> {
    const response = await apiClient.post<{ message: string; expiresIn: number }>(
      "/api/users/register/verify-otp",
      { email, otp },
    );
    return response.data;
  }

  // POST /api/users/register/complete - hoàn tất đăng ký sau xác thực OTP
  async registerComplete(data: RegisterData): Promise<{ message: string; user: User }> {
    const response = await apiClient.post<{ message: string; user: ServerUser }>(
      "/api/users/register/complete",
      data,
    );
    return { message: response.data.message, user: mapServerUser(response.data.user) };
  }

  // GET /api/users/:userId/login-history - lấy lịch sử đăng nhập
  async getLoginHistory(userId: string, limit: number = 20): Promise<LoginHistoryItem[]> {
    const response = await apiClient.get<LoginHistoryItem[]>(
      `/api/users/${userId}/login-history`,
      { params: { limit } },
    );
    return response.data;
  }

}


export const userService = new UserService();
