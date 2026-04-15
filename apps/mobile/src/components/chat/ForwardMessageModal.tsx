import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { chatService } from "@/services/chat";
import type { Message, Conversation } from "@/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/ui/Avatar";

interface ForwardMessageModalProps {
  visible: boolean;
  onClose: () => void;
  message: Message | null;
}

export function ForwardMessageModal({
  visible,
  onClose,
  message,
}: ForwardMessageModalProps) {
  const insets = useSafeAreaInsets();
  const { conversations } = useChatStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  const filteredConversations = conversations.filter((c) => {
    const name = c.name || c.participants?.find(p => p.userId !== user?.id)?.fullName || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (!message || selectedIds.length === 0) return;
    setIsSending(true);
    try {
      const baseMetadata =
        message.metadata && typeof message.metadata === "object"
          ? message.metadata
          : {};
      for (const convId of selectedIds) {
        await chatService.sendMessage(convId, {
          type: message.type,
          content: message.content,
          metadata: {
            ...baseMetadata,
            isForwarded: true,
            forwardedFromMessageId: message.id,
            forwardedAt: new Date().toISOString(),
          },
        });
      }
      onClose();
      setSelectedIds([]);
      setSearch("");
    } catch (e) {
      console.error("Forward failed", e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.title}>Chuyển tiếp</Text>
            <TouchableOpacity 
              onPress={handleForward} 
              disabled={selectedIds.length === 0 || isSending}
              style={[styles.sendBtn, selectedIds.length > 0 && styles.sendBtnActive]}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.sendText, selectedIds.length > 0 && styles.sendTextActive]}>Gửi</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#6B7280" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Tìm kiếm bạn bè..."
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
          </View>

          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const name = item.name || item.participants?.find(p => p.userId !== user?.id)?.fullName || "Người dùng";
              const avatar = item.avatarUrl || item.participants?.find(p => p.userId !== user?.id)?.avatarUrl;
              const isSelected = selectedIds.includes(item.id);

              return (
                <TouchableOpacity 
                  style={styles.item} 
                  onPress={() => toggleSelect(item.id)}
                >
                  <Avatar name={name} uri={avatar} size={40} />
                  <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.list}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  sendBtnActive: {
    backgroundColor: "#0068FF",
  },
  sendText: {
    fontWeight: "600",
    color: "#9CA3AF",
  },
  sendTextActive: {
    color: "#fff",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: "#111827",
  },
  list: {
    paddingBottom: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemName: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#111827",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: "#0068FF",
    borderColor: "#0068FF",
  },
});
