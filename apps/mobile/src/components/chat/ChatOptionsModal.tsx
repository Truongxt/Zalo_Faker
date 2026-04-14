import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Switch,
  FlatList,
  Alert,
  TextInput,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { API_URL } from "@/constants/config";
import { conversationService, labelService } from "@/services";
import type { Label, Conversation } from "@/types";

interface ChatOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation;
}

const PRESET_BACKGROUNDS = [
  { name: "Nền trắng", value: "" },
  { name: "Xanh nhạt", value: "#E0F7FF" },
  { name: "Hồng nhạt", value: "#FCE4EC" },
  { name: "Vàng nhạt", value: "#FFFDE7" },
  { name: "Xanh lá nhạt", value: "#E8F5E9" },
  { name: "Tím nhạt", value: "#F3E5F5" },
];

export function ChatOptionsModal({
  visible,
  onClose,
  conversation,
}: ChatOptionsModalProps) {
  const { user, accessToken } = useAuthStore();
  const {
    labels,
    setLabels,
    addLabel,
    updateConversation,
  } = useChatStore();

  const [isLoading, setIsLoading] = useState(false);

  // States for toggle mute
  const currentParticipant = conversation.participants?.find(
    (p) => p.userId === user?.id
  );
  const isMuted = currentParticipant?.isMuted || false;
  const conversationLabelIds = currentParticipant?.labelIds || [];

  // View states
  const [activeTab, setActiveTab] = useState<"menu" | "background" | "labels">("menu");
  const [newLabelName, setNewLabelName] = useState("");
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  useEffect(() => {
    if (visible && labels.length === 0) {
      loadLabels();
    }
  }, [visible]);

  const loadLabels = async () => {
    try {
      const data = await labelService.getLabels();
      setLabels(data);
    } catch (e) {
      console.warn("Khong the tai danh sach nhan", e);
    }
  };

  const handleToggleMute = async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      await conversationService.updateParticipantSetting(
        conversation.id,
        user.id,
        { isMuted: !isMuted }
      );
      updateConversation(conversation.id, {
        participants: conversation.participants?.map((p) =>
          p.userId === user.id ? { ...p, isMuted: !isMuted } : p
        ),
      });
    } catch (error) {
      Alert.alert("Lỗi", "Không thể cập nhật thông báo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateBackground = async (bgValue: string) => {
    try {
      setIsLoading(true);
      await conversationService.updateConversationBackground(conversation.id, bgValue);
      updateConversation(conversation.id, { background: bgValue });
      setActiveTab("menu");
    } catch (error) {
      Alert.alert("Lỗi", "Không thể cập nhật hình nền");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickLibraryBg = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Lỗi", "Cần quyền truy cập thư viện ảnh");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      setIsLoading(true);
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.fileName || "bg.jpg",
        type: asset.mimeType || "image/jpeg",
      } as any);

      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload that bai");
      const data = await res.json();
      await handleUpdateBackground(data.url);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể tải ảnh nền lên");
      setIsLoading(false);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    try {
      setIsCreatingLabel(true);
      const newLabel = await labelService.createLabel({
        name: newLabelName.trim(),
        color: "#0068FF", // Mặc định màu xanh
      });
      addLabel(newLabel);
      setNewLabelName("");
    } catch (e) {
      Alert.alert("Lỗi", "Không thể tạo nhãn");
    } finally {
      setIsCreatingLabel(false);
    }
  };

  const toggleConversationLabel = async (labelId: string) => {
    if (!user?.id) return;
    const isEditing = true; 
    let newLabelIds = [...conversationLabelIds];
    
    if (newLabelIds.includes(labelId)) {
      newLabelIds = newLabelIds.filter((id) => id !== labelId);
    } else {
      newLabelIds.push(labelId);
    }

    try {
      await conversationService.updateParticipantSetting(
        conversation.id,
        user.id,
        { labelIds: newLabelIds }
      );
      updateConversation(conversation.id, {
        participants: conversation.participants?.map((p) =>
          p.userId === user.id ? { ...p, labelIds: newLabelIds } : p
        ),
      });
    } catch (e) {
      Alert.alert("Lỗi", "Không thể cập nhật nhãn cho cuộc trò chuyện");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#F3F4F6",
          }}
        >
          <TouchableOpacity onPress={() => (activeTab === "menu" ? onClose() : setActiveTab("menu"))}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "600", marginLeft: 16, color: "#111827" }}>
            {activeTab === "menu" && "Tùy chọn"}
            {activeTab === "background" && "Đổi hình nền"}
            {activeTab === "labels" && "Phân loại nhãn"}
          </Text>
        </View>

        {activeTab === "menu" && (
          <View style={{ flex: 1, padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Text style={{ fontSize: 16, color: "#111827" }}>Tắt thông báo</Text>
              {isLoading ? (
                <ActivityIndicator color="#0068FF" />
              ) : (
                <Switch value={isMuted} onValueChange={handleToggleMute} color="#0068FF" />
              )}
            </View>

            <TouchableOpacity style={{ marginBottom: 24 }} onPress={() => setActiveTab("background")}>
              <Text style={{ fontSize: 16, color: "#111827" }}>Đổi hình nền</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ marginBottom: 24 }} onPress={() => setActiveTab("labels")}>
              <Text style={{ fontSize: 16, color: "#111827" }}>Phân loại nhãn</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === "background" && (
          <View style={{ flex: 1, padding: 16 }}>
            <TouchableOpacity
              onPress={handlePickLibraryBg}
              style={{
                padding: 16,
                backgroundColor: "#F3F4F6",
                borderRadius: 8,
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Ionicons name="image-outline" size={24} color="#0068FF" />
              <Text style={{ color: "#0068FF", marginTop: 8, fontWeight: "500" }}>Chọn ảnh từ thiết bị</Text>
            </TouchableOpacity>

            <Text style={{ fontSize: 14, color: "#6B7280", marginBottom: 12 }}>Bảng màu có sẵn</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {PRESET_BACKGROUNDS.map((bg) => {
                const isActive = conversation.background === bg.value;
                return (
                  <TouchableOpacity
                    key={bg.value}
                    onPress={() => handleUpdateBackground(bg.value)}
                    style={{
                      width: "30%",
                      aspectRatio: 1,
                      backgroundColor: bg.value || "#E5E7EB", // Show gray for blank
                      borderRadius: 8,
                      borderWidth: isActive ? 3 : 1,
                      borderColor: isActive ? "#0068FF" : "#E5E7EB",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 12, textAlign: "center", padding: 4 }}>{bg.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isLoading && <ActivityIndicator style={{ marginTop: 24 }} size="large" color="#0068FF" />}
          </View>
        )}

        {activeTab === "labels" && (
          <View style={{ flex: 1, padding: 16 }}>
             <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <TextInput
                value={newLabelName}
                onChangeText={setNewLabelName}
                placeholder="Nhập tên nhãn mới..."
                style={{ flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 10 }}
              />
              <TouchableOpacity
                onPress={handleCreateLabel}
                disabled={isCreatingLabel || !newLabelName.trim()}
                style={{ marginLeft: 12, backgroundColor: "#0068FF", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 }}
              >
                {isCreatingLabel ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: "600" }}>Tạo</Text>}
              </TouchableOpacity>
            </View>

            <FlatList
              data={labels}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => {
                const isSelected = conversationLabelIds.includes(item._id);
                return (
                  <TouchableOpacity
                    onPress={() => toggleConversationLabel(item._id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: "#F3F4F6",
                    }}
                  >
                     <View style={{width: 20, height: 20, borderRadius: 4, backgroundColor: item.color, marginRight: 12}} />
                     <Text style={{ flex: 1, fontSize: 16, color: "#111827" }}>{item.name}</Text>
                     <Switch value={isSelected} onValueChange={() => toggleConversationLabel(item._id)} color="#0068FF" />
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}
