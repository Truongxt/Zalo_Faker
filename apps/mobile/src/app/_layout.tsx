import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Alert } from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { socketService } from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import FlashMessage from "react-native-flash-message";
// Giữ splash screen
SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn(
    "[splash] preventAutoHideAsync failed:",
    error?.message || error,
  );
});

export default function RootLayout() {
  const router = useRouter();
  const { initialized, initialize, isAuthenticated, user, logout } =
    useAuthStore();

  useEffect(() => {
    initialize().finally(() => {
      SplashScreen.hideAsync().catch((error) => {
        console.warn("[splash] hideAsync failed:", error?.message || error);
      });
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      socketService.disconnect();
      return;
    }

    useChatStore.getState().initializeCacheForUser(String(user.id));

    socketService.connect();

    const forceLogout = (reason?: string) => {
      if (!useAuthStore.getState().user) return;
      socketService.disconnect();
      logout();
      Alert.alert(
        "Co tai khoan da dang nhap",
        reason || "Tai khoan cua ban da dang nhap o thiet bi khac.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }],
      );
    };

    const handleForceLogout = (data?: { reason?: string }) => {
      forceLogout(data?.reason);
    };

    const handleConnectError = (error: { message?: string }) => {
      const message = String(error?.message || "").toLowerCase();
      if (!message.includes("session expired")) return;
      forceLogout("Phien dang nhap da het hieu luc. Vui long dang nhap lai.");
    };

    socketService.on("session:force_logout", handleForceLogout);
    socketService.on("connect_error", handleConnectError);

    return () => {
      socketService.off("session:force_logout", handleForceLogout);
      socketService.off("connect_error", handleConnectError);
    };
  }, [isAuthenticated, user?.id, logout, router]);

  if (!initialized) {
    return null;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar
          style="light"
          backgroundColor="#0068FF"
          translucent={false}
        />

        <Stack screenOptions={{ headerShown: false }}>
          {isAuthenticated ? (
            <>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="chat/[conversationId]"
                options={{ animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="call/[callId]"
                options={{ presentation: "fullScreenModal" }}
              />
              <Stack.Screen
                name="profile/[userId]"
                options={{ animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="group/create"
                options={{ presentation: "modal" }}
              />
              <Stack.Screen
                name="group/[groupId]"
                options={{ animation: "slide_from_right" }}
              />
            </>
          ) : (
            <Stack.Screen name="(auth)" />
          )}
        </Stack>
        <FlashMessage />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
