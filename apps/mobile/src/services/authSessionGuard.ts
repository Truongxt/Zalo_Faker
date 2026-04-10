import { Alert } from "react-native";
import { useAuthStore } from "@/stores/authStore";

let lastAlertAt = 0;

const shouldShowAlert = () => {
  const now = Date.now();
  if (now - lastAlertAt < 1500) {
    return false;
  }
  lastAlertAt = now;
  return true;
};

export const forceLogoutWithNotice = (reason?: string) => {
  const hasUser = Boolean(useAuthStore.getState().user || useAuthStore.getState().accessToken);

  useAuthStore.getState().logout();

  if (!hasUser) {
    return;
  }

  if (!shouldShowAlert()) {
    return;
  }

  Alert.alert(
    "Phien dang nhap het han",
    reason || "Khong tim thay access token. Vui long dang nhap lai.",
  );
};
