import { Platform } from "react-native";

const DEFAULT_API_URL = Platform.select({
  android: "http://10.0.2.2:3000",
  web: "http://localhost:3000",
  default: "http://localhost:3000",
});

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

export const SOCKET_URL =
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

export const APP_CONFIG = {
  name: "Zalo Faker",
  version: "1.0.0",
  maxFileSize: 25 * 1024 * 1024, // 25MB
  maxImageSize: 10 * 1024 * 1024, // 10MB
  maxVideoSize: 50 * 1024 * 1024, // 50MB
  maxGroupMembers: 100,
  supportedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  supportedVideoTypes: ["video/mp4", "video/quicktime"],
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_DATA: "user_data",
  THEME: "theme",
  LANGUAGE: "language",
  NOTIFICATION_SETTINGS: "notification_settings",
} as const;

export const MESSAGE_LIMITS = {
  PAGE_SIZE: 30,
  MAX_TEXT_LENGTH: 5000,
  MAX_ATTACHMENTS: 10,
} as const;
