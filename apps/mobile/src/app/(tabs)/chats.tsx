import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { ConversationItem } from "@/components/chat/ConversationItem";

export default function ChatsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { conversations } = useChatStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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
    // TODO: Reload conversations
    setRefreshing(false);
  }, []);

  return (
    <View className="flex-1 bg-white">
      {/* Search bar */}
      <View className="px-4 py-2 bg-white border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 h-10">
          <Text className="mr-2">🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm kiếm"
            className="flex-1 text-gray-900"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* Conversations list */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            currentUserId={user?.id || ""}
            onPress={() => router.push(`/chat/${item.id}`)}
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

      {/* FAB - New conversation */}
      <TouchableOpacity
        onPress={() => {
          /* TODO: New conversation */
        }}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-[#0068FF] items-center justify-center shadow-lg"
        activeOpacity={0.8}
      >
        <Text className="text-white text-2xl">✏️</Text>
      </TouchableOpacity>
    </View>
  );
}
