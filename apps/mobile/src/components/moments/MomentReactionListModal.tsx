import React, { useState, useEffect } from "react";
import { View, Text, Modal, TouchableOpacity, FlatList, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { momentService } from "@/services/momentService";
import { useAuthStore } from "@/stores/authStore";
import type { MomentReaction } from "@/types";
import { REACTION_OPTIONS } from "./momentHelpers";

// Since friendService might be different or not fully implemented on mobile,
// I'll check if we have an equivalent to friendService or just use a placeholder
// wait, I will look up friendService in mobile first, but let's write the base structure.
// I'll update it to match mobile styling (Tailwind/NativeWind).

interface MomentReactionListModalProps {
  momentId: string;
  visible: boolean;
  onClose: () => void;
}

export default function MomentReactionListModal({
  momentId,
  visible,
  onClose,
}: MomentReactionListModalProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [reactions, setReactions] = useState<MomentReaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const reactionsData = await momentService.getMomentReactions(momentId);
        setReactions(reactionsData || []);
      } catch (error) {
        console.error("Failed to fetch moment reactions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [momentId, visible]);

  const handleUserPress = (userId: string) => {
    onClose();
    router.push(`/profile/${userId}`);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ width: "100%", maxHeight: "80%", backgroundColor: "white", borderRadius: 16, overflow: "hidden" }}
        >
          <View className="flex-row items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800 dark:bg-dark-200">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">
              Người đã bày tỏ cảm xúc
            </Text>
            <TouchableOpacity onPress={onClose} className="rounded-full p-2">
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View className="flex-1 bg-white dark:bg-dark-200">
            {isLoading ? (
              <View className="py-8 justify-center items-center">
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            ) : reactions.length === 0 ? (
              <View className="py-8 justify-center items-center">
                <Text className="text-gray-500 dark:text-gray-400">Chưa có cảm xúc nào</Text>
              </View>
            ) : (
              <FlatList
                data={reactions}
                keyExtractor={(item) => item.userId}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => {
                  const reactionInfo = REACTION_OPTIONS.find((r) => r.key === item.emoji);
                  const author = item.user;

                  return (
                    <TouchableOpacity
                      onPress={() => handleUserPress(item.userId)}
                      className="flex-row items-center justify-between mb-4"
                    >
                      <View className="flex-row items-center flex-1">
                        <View className="relative mr-3">
                          {author?.avartarUrl ? (
                            <Image
                              source={{ uri: author.avartarUrl }}
                              className="h-12 w-12 rounded-full"
                            />
                          ) : (
                            <View className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center">
                              <Text className="text-blue-600 dark:text-blue-400 font-semibold text-lg">
                                {(author?.userName || "U").charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View className="absolute -bottom-1 -right-1 bg-white dark:bg-dark-200 rounded-full w-5 h-5 items-center justify-center">
                            <Text style={{ fontSize: 12 }}>{reactionInfo?.icon || "👍"}</Text>
                          </View>
                        </View>
                        <Text className="text-base font-medium text-gray-900 dark:text-gray-100 flex-1" numberOfLines={1}>
                          {author?.userName || "Người dùng"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
