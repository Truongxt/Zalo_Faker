import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { chatService } from "@/services/chat";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Colors } from "@/constants/colors";

export default function ChatRoomScreen() {
  return <View className="flex-1 bg-gray-50"></View>;
}
