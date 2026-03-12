import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL, STORAGE_KEYS } from "@/constants/config";

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  let token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

  // Fallback to Zustand persisted auth state when AUTH_TOKEN key is not set.
  if (!token) {
    const persistedAuth = await AsyncStorage.getItem("auth-storage");
    if (persistedAuth) {
      try {
        const parsed = JSON.parse(persistedAuth);
        token = parsed?.state?.accessToken ?? null;
      } catch {
        token = null;
      }
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default apiClient;