import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";

const resolveExpoProjectId = (): string | null => {
  const fromEasConfig = String(Constants?.easConfig?.projectId || "").trim();
  if (fromEasConfig) {
    return fromEasConfig;
  }

  const fromExpoConfig = String(
    Constants?.expoConfig?.extra?.eas?.projectId || "",
  ).trim();
  if (fromExpoConfig) {
    return fromExpoConfig;
  }

  const fromEnv = String(process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "").trim();
  if (fromEnv) {
    return fromEnv;
  }

  return null;
};

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  async registerForPushNotificationsAsync() {
    let token: string | undefined;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        console.warn("Failed to get push token for push notification!");
        return;
      }
      
      try {
        const projectId = resolveExpoProjectId();
        if (!projectId) {
          console.warn(
            'Skip getting Expo push token: missing EAS projectId. Set EXPO_PUBLIC_EAS_PROJECT_ID in apps/mobile/.env or expo.extra.eas.projectId in app config.',
          );
          return;
        }
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } catch (e) {
        console.error("Error getting expo push token", e);
      }
    } else {
      console.log("Must use physical device for Push Notifications");
    }

    return token;
  },

  async showLocalNotification(title: string, body: string, data: any = {}, icon?: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        // largeIcon is only supported on Android and usually requires a local resource,
        // but some versions of expo-notifications might support URLs or we can just pass it in data.
      },
      trigger: null,
    });
  },
};
