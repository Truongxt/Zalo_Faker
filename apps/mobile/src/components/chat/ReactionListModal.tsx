import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import type { MessageReaction } from "@/types";

interface ReactionListModalProps {
  isVisible: boolean;
  onClose: () => void;
  reactions: MessageReaction[];
}

export function ReactionListModal({
  isVisible,
  onClose,
  reactions,
}: ReactionListModalProps) {
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable 
        className="flex-1 bg-black/40 justify-end" 
        onPress={onClose}
      >
        <Pressable 
          className="bg-white rounded-t-[24px] h-[50%]"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
            <Text className="text-lg font-bold text-gray-900">
              Biểu cảm ({reactions.length})
            </Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* List */}
          <FlatList
            data={reactions}
            keyExtractor={(item, index) => `${item.userId}-${item.emoji}-${index}`}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View className="flex-row items-center px-4 py-3 border-b border-gray-50">
                <View className="relative">
                  <Avatar 
                    name={item.userName || "?"} 
                    size={44}
                  />
                  <View className="absolute -right-1 -bottom-1 bg-white rounded-full p-0.5 shadow-sm">
                    <Text className="text-xs">{item.emoji}</Text>
                  </View>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-semibold text-gray-900">
                    {item.userName || "Người dùng"}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center pt-10">
                <Text className="text-gray-500">Chưa có biểu cảm nào</Text>
              </View>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
