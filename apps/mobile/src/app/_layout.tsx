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
  const { initialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize().finally(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="light" backgroundColor="#0068FF" translucent={false} />

      {initialized ? (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
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
        </Stack>
      ) : null}
      <FlashMessage />
    </SafeAreaProvider>
  );
}
