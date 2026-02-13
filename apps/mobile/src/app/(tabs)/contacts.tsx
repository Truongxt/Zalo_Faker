import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  SectionList,
} from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/ui/Avatar";

export default function ContactsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // TODO: Load contacts from store/API

  return (
    <View className="flex-1 bg-white">
      {/* Search */}
      <View className="px-4 py-2 border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 h-10">
          <Text className="mr-2">🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm bạn bè"
            className="flex-1 text-gray-900"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* Quick actions */}
      <View className="border-b border-gray-100">
        <TouchableOpacity className="flex-row items-center px-4 py-3 gap-3">
          <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
            <Text>👥</Text>
          </View>
          <Text className="text-gray-900 font-medium">Tạo nhóm mới</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center px-4 py-3 gap-3">
          <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center">
            <Text>➕</Text>
          </View>
          <Text className="text-gray-900 font-medium">Thêm bạn</Text>
        </TouchableOpacity>
      </View>

      {/* Contacts list */}
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-500">Chưa có danh bạ</Text>
      </View>
    </View>
  );
}
