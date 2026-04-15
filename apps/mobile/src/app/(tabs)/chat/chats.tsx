import { useState, useCallback, useEffect } from "react";
import { View, Text, FlatList, RefreshControl, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { ConversationItem } from "@/components/chat/ConversationItem";
import { ConversationMenuModal } from "@/components/chat/ConversationActionModals";
import { chatService } from "@/services/chat";
import { labelService } from "@/services";
import { socketService } from "@/lib/socket";
import type { Conversation } from "@/types";

export default function ChatsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { conversations, labels, setLabels, unlockedHiddenChats } = useChatStore();

  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, boolean>>({});
  const [menuTarget, setMenuTarget] = useState<Conversation | null>(null);

  useEffect(() => {
    chatService.init();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      chatService.loadConversations();
      labelService.getLabels().then(setLabels).catch(() => {});
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
          conv.participants.find((p) => String(p.userId) !== String(user.id))?.userId || "",
        ),
      )
      .filter((id) => id && id !== "undefined");

    if (privatePartnerIds.length > 0) {
      socketService.emit(
        "presence:get_online_users",
        privatePartnerIds,
        (response: { success: boolean; onlineStatuses?: Record<string, boolean> }) => {
          if (!response?.success || !response.onlineStatuses) return;
          setOnlineStatuses(response.onlineStatuses);
        },
      );
    }

    const handlePresenceOnline = ({ userId }: { userId: string }) =>
      setOnlineStatuses((prev) => ({ ...prev, [String(userId)]: true }));

    const handlePresenceOffline = ({ userId }: { userId: string }) =>
      setOnlineStatuses((prev) => ({ ...prev, [String(userId)]: false }));

    socketService.on("presence:online", handlePresenceOnline);
    socketService.on("presence:offline", handlePresenceOffline);
    return () => {
      socketService.off("presence:online", handlePresenceOnline);
      socketService.off("presence:offline", handlePresenceOffline);
    };
  }, [user?.id, conversations]);

  const filteredConversations = conversations
    .filter((conv) => {
      const p = conv.participants.find((p) => String(p.userId) === String(user?.id));
      if (!p) return false;

      // If UNLOCKED: Only show hidden conversations
      if (unlockedHiddenChats) {
        return p?.isHidden === true;
      }
      
      // If LOCKED: Only show non-hidden conversations
      if (p?.isHidden) {
        return false;
      }

      if (selectedLabelId) {
        if (!p?.labelIds?.includes(selectedLabelId)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await chatService.loadConversations();
    setRefreshing(false);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Labels Filter Bar */}
      {labels.length > 0 && (
        <View
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderBottomWidth: 1,
            borderBottomColor: "#F3F4F6",
          }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => setSelectedLabelId(null)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: selectedLabelId === null ? "#0068FF" : "#F3F4F6",
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  color: selectedLabelId === null ? "#FFF" : "#4B5563",
                  fontSize: 13,
                  fontWeight: "500",
                }}
              >
                Tất cả
              </Text>
            </TouchableOpacity>
            {labels.map((l) => (
              <TouchableOpacity
                key={l._id}
                onPress={() => setSelectedLabelId(l._id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: selectedLabelId === l._id ? "#0068FF" : "#F3F4F6",
                  marginRight: 8,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: l.color,
                    marginRight: 6,
                  }}
                />
                <Text
                  style={{
                    color: selectedLabelId === l._id ? "#FFF" : "#4B5563",
                    fontSize: 13,
                    fontWeight: "500",
                  }}
                >
                  {l.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Conversations list */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            currentUserId={user?.id || ""}
            allLabels={labels}
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
            onLongPress={(conv) => setMenuTarget(conv)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={filteredConversations.length === 0 ? { flex: 1 } : undefined}
        ListEmptyComponent={
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}
          >
            <Text style={{ fontSize: 36, marginBottom: 8 }}>💬</Text>
            <Text style={{ color: "#9CA3AF" }}>Chưa có cuộc trò chuyện</Text>
          </View>
        }
      />

      {/* Long-press context menu */}
      <ConversationMenuModal
        visible={!!menuTarget}
        conversation={menuTarget}
        onClose={() => setMenuTarget(null)}
      />
    </View>
  );
}
