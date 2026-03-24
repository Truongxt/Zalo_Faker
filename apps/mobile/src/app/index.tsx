import { Redirect } from "expo-router";
import { useAuthStore } from "@/stores/authStore";

export default function Index() {
  const { user } = useAuthStore();

  if (user) {
    return <Redirect href="/(tabs)/chat/chats" />;
  }

  return <Redirect href="/(auth)/login" />;
}
