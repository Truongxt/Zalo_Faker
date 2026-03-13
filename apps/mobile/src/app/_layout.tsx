import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/authStore";
import FlashMessage from "react-native-flash-message";
// Giữ splash screen
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialized, initialize, isAuthenticated } = useAuthStore();

  useEffect(() => {
    initialize().finally(() => {
      SplashScreen.hideAsync();
    });
  }, []);
  if (!initialized) {
    return null;
  }
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="light" backgroundColor="#0068FF" translucent={false} />

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
  );
}
