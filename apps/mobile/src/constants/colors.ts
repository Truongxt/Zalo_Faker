export const Colors = {
  // Primary - Zalo Blue
  primary: "#0068FF",
  primaryDark: "#0054CC",
  primaryLight: "#4D94FF",
  primaryBg: "#E6F0FF",

  // Secondary
  secondary: "#00C853",
  secondaryDark: "#009624",

  // Background
  background: "#FFFFFF",
  backgroundSecondary: "#F5F5F5",
  backgroundTertiary: "#EEEEEE",
  surface: "#FFFFFF",

  // Text
  text: "#1A1A1A",
  textSecondary: "#757575",
  textTertiary: "#999999",
  textInverse: "#FFFFFF",
  textLink: "#0068FF",

  // Chat bubbles
  bubbleSent: "#D5E8FF",
  bubbleSentText: "#1A1A1A",
  bubbleReceived: "#F0F0F0",
  bubbleReceivedText: "#1A1A1A",

  // Status
  online: "#4CAF50",
  offline: "#9E9E9E",
  away: "#FF9800",
  busy: "#F44336",

  // UI Elements
  border: "#E0E0E0",
  borderLight: "#F0F0F0",
  divider: "#EEEEEE",
  icon: "#757575",
  iconActive: "#0068FF",
  placeholder: "#BDBDBD",

  // Feedback
  success: "#4CAF50",
  warning: "#FF9800",
  error: "#F44336",
  info: "#2196F3",

  // Others
  unreadBadge: "#FF3B30",
  shadow: "rgba(0, 0, 0, 0.1)",
  overlay: "rgba(0, 0, 0, 0.5)",
  tabBarBg: "#FFFFFF",
  headerBg: "#0068FF",
} as const;

export type ColorName = keyof typeof Colors;
