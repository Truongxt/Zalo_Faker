import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "@/services/apiClient";

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  avatar?: string;
  text: string;
};

export default function GroupChatScreen() {
  const params = useLocalSearchParams();
  const groupId = Array.isArray(params.groupId)
    ? params.groupId[0]
    : params.groupId;

  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const currentUserId = "me";
  const flatListRef = useRef<FlatList>(null);

  /* ===================== LOAD GROUP ===================== */

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const res = await apiClient.get("/api/groups");

        const found = res.data.find((g: any) => g._id === groupId);

        setGroup(found);
      } catch (error) {
        console.log("fetch group error:", error);
      }
    };

    fetchGroup();
  }, [groupId]);

  /* ===================== DEMO MESSAGE ===================== */

  useEffect(() => {
    setMessages([
      {
        id: "1",
        senderId: "u1",
        senderName: "An",
        avatar: "https://i.pravatar.cc/150?img=1",
        text: "Chào mọi người 👋",
      },
      {
        id: "2",
        senderId: "me",
        senderName: "Bạn",
        text: "Hello!",
      },
    ]);
  }, []);

  /* ===================== AUTO SCROLL ===================== */

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  /* ===================== SEND MESSAGE ===================== */

  const sendMessage = () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: currentUserId,
      senderName: "Bạn",
      text: input,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
  };

  /* ===================== MESSAGE ITEM ===================== */

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUserId;

    return (
      <View className={`flex-row mb-3 ${isMe ? "justify-end" : ""}`}>
        {!isMe && (
          <Image
            source={{
              uri:
                item.avatar ||
                "https://cdn-icons-png.flaticon.com/512/149/149071.png",
            }}
            className="w-8 h-8 rounded-full mr-2"
          />
        )}

        <View className={`max-w-[70%] ${isMe ? "items-end" : ""}`}>
          {!isMe && (
            <Text className="text-xs text-gray-500 mb-1">
              {item.senderName}
            </Text>
          )}

          <View
            className={`px-4 py-2 rounded-2xl ${
              isMe ? "bg-blue-500" : "bg-gray-200"
            }`}
          >
            <Text className={`${isMe ? "text-white" : "text-black"}`}>
              {item.text}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (!groupId) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Không tìm thấy nhóm</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ================= HEADER ================= */}

      <View className="h-14 border-b flex-row items-center px-3 bg-white">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>

        <Image
          source={{
            uri:
              group?.avatar ||
              "https://cdn-icons-png.flaticon.com/512/166/166258.png",
          }}
          className="w-9 h-9 rounded-full mr-2"
        />

        <View className="flex-1">
          <Text className="font-semibold text-base">
            {group?.name || "Đang tải..."}
          </Text>

          {group?.members && (
            <Text className="text-xs text-gray-500">
              {group.members.length} thành viên
            </Text>
          )}
        </View>

        <TouchableOpacity className="mx-2">
          <Ionicons name="call-outline" size={22} color="#111" />
        </TouchableOpacity>

        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={20} color="#111" />
        </TouchableOpacity>
      </View>

      {/* ================= MESSAGE LIST ================= */}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 16 }}
      />

      {/* ================= INPUT ================= */}

      <View className="flex-row items-center border-t px-3 py-2">
        <TouchableOpacity className="mr-2">
          <Ionicons name="add-circle-outline" size={26} color="#666" />
        </TouchableOpacity>

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Nhập tin nhắn..."
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2"
        />

        <TouchableOpacity onPress={sendMessage}>
          <Ionicons name="send" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
