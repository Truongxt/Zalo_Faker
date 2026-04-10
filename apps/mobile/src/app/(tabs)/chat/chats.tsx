import { useState, useCallback, useEffect } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { ConversationItem } from "@/components/chat/ConversationItem";
import { chatService } from "@/services/chat";
import { socketService } from "@/lib/socket";

export default function ChatsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { conversations } = useChatStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    chatService.init();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      chatService.loadConversations();
    }, [user?.id]),
  );

  useEffect(() => {
    if (!user?.id) return;

    if (!socketService.getSocket()?.connected) {
      socketService.connect();
    }

    const privatePartnerIds = conversations
      .filter((conv) => conv.type === "private")
      .map((conv) =>
        String(
          conv.participants.find((p) => String(p.userId) !== String(user.id))
            ?.userId || "",
        ),
      )
      .filter((id) => id && id !== "undefined");

    if (privatePartnerIds.length > 0) {
      socketService.emit(
        "presence:get_online_users",
        privatePartnerIds,
        (response: {
          success: boolean;
          onlineStatuses?: Record<string, boolean>;
        }) => {
          if (!response?.success || !response.onlineStatuses) return;
          setOnlineStatuses(response.onlineStatuses);
        },
      );
    }

    const handlePresenceOnline = ({ userId }: { userId: string }) => {
      setOnlineStatuses((prev) => ({ ...prev, [String(userId)]: true }));
    };

    const handlePresenceOffline = ({ userId }: { userId: string }) => {
      setOnlineStatuses((prev) => ({ ...prev, [String(userId)]: false }));
    };

    socketService.on("presence:online", handlePresenceOnline);
    socketService.on("presence:offline", handlePresenceOffline);

    return () => {
      socketService.off("presence:online", handlePresenceOnline);
      socketService.off("presence:offline", handlePresenceOffline);
    };
  }, [user?.id, conversations]);

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
            isOnline={
              item.type === "private"
                ? Boolean(
                    onlineStatuses[
                      String(
                        item.participants.find(
                          (p) => String(p.userId) !== String(user?.id),
                        )?.userId || "",
                      )
                    ],
                  )
                : false
            }
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
