import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL, STORAGE_KEYS } from "@/constants/config";
import { useAuthStore } from "@/stores/authStore";

const apiClient = axios.create({
  baseURL: API_URL,
});

console.log("[apiClient] baseURL:", API_URL);

apiClient.interceptors.request.use(async (config) => {
  const finalUrl = `${config.baseURL || API_URL}${config.url || ""}`;
  console.log("[apiClient] interceptor running for:", config.url);
  console.log("[apiClient] final url:", finalUrl);
  const url = config.url || "";
  const isPublicAuthRequest =
    url.includes("/login") ||
    url.includes("/register") ||
    url.includes("/refresh-token") ||
    url.includes("/forgot-password") ||
    url.includes("/logout");

  const isFormData =
    typeof FormData !== "undefined" && config.data instanceof FormData;

  if (isFormData) {
    if (config.headers) {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }
  } else {
    if (!config.headers) {
      config.headers = {} as typeof config.headers;
    }

    if (!config.headers["Content-Type"] && !config.headers["content-type"]) {
      config.headers["Content-Type"] = "application/json";
    }
  }

  if (isPublicAuthRequest) {
    return config;
  }

  let token: string | null = null;

  try {
    // 1. Try in-memory Zustand token first (fastest, always up-to-date)
    token = useAuthStore.getState().accessToken;
    console.log("[apiClient] Zustand token:", token ? "found" : "null");
  } catch (e) {
    console.warn("[apiClient] Zustand getState failed:", e);
  }

  // 2. Fallback to AsyncStorage direct key
  if (!token) {
    token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    console.log("[apiClient] AsyncStorage AUTH_TOKEN:", token ? "found" : "null");
  }

  // 3. Fallback to Zustand persisted state in AsyncStorage
  if (!token) {
    const persistedAuth = await AsyncStorage.getItem("auth-storage");
    if (persistedAuth) {
      try {
        const parsed = JSON.parse(persistedAuth);
        token = parsed?.state?.accessToken ?? null;
        console.log("[apiClient] persisted auth-storage token:", token ? "found" : "null");
      } catch {
        token = null;
      }
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn("[apiClient] No auth token found for request:", config.url);
  }

  return config;
});

// --- Response interceptor: auto-refresh on 401 ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (token) prom.resolve(token);
    else prom.reject(error);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error?.response) {
      console.log("[apiClient] network failure", {
        baseURL: error?.config?.baseURL || API_URL,
        url: error?.config?.url,
        message: error?.message,
        code: error?.code,
      });
    }

    const originalRequest = error.config;

    // Only attempt refresh for 401 and not already retried
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh for auth endpoints themselves
    const url = originalRequest.url || "";
    if (
      url.includes("/login") ||
      url.includes("/register") ||
      url.includes("/refresh-token") ||
      url.includes("/logout")
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until refresh completes
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          },
          reject: (err: unknown) => reject(err),
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const { data } = await axios.post<{ accessToken: string }>(
        `${API_URL}/api/users/refresh-token`,
        { refreshToken },
      );

      const newAccessToken = data.accessToken;

      // Update Zustand store
      useAuthStore.getState().setAccessToken(newAccessToken);

      // Retry original request with new token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      processQueue(null, newAccessToken);
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Refresh failed → force logout
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;
