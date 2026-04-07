import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { ConversationItem } from "@/components/chat/ConversationItem";
import { chatService } from "@/services/chat";

export default function ChatsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { conversations } = useChatStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    chatService.init();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      chatService.loadConversations();
    }, [user?.id]),
  );

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const name =
      conv.type === "group"
        ? conv.name
        : conv.participants.find((p) => p.userId !== user?.id)?.fullName;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await chatService.loadConversations();
    setRefreshing(false);
  }, []);

  return (
    <View className="flex-1 bg-white">
      {/* Conversations list */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            currentUserId={user?.id || ""}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/chat/[conversationId]",
                params: { conversationId: String(item.id) },
              })
            }
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={
          filteredConversations.length === 0 ? { flex: 1 } : undefined
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-4xl mb-3">💬</Text>
            <Text className="text-gray-500">Chưa có cuộc trò chuyện</Text>
          </View>
        }
      />
    </View>
  );
}
