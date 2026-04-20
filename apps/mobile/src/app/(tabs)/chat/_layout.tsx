import { Stack } from "expo-router";

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="chats" />
      <Stack.Screen name="[conversationId]" />
      <Stack.Screen name="conversation-info" />
      <Stack.Screen name="create-poll" />
    </Stack>
  );
}
