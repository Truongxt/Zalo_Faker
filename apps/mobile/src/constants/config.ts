export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.108:3000";

export const SOCKET_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.108:3000";

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
