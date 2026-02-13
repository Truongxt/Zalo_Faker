import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/ui/Avatar";

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // TODO: Fetch user data

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 h-12">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-[#0068FF] text-base">← Quay lại</Text>
        </TouchableOpacity>
      </View>

      {/* Profile */}
      <View className="items-center py-8 bg-white mb-2">
        <Avatar name="User" size={80} />
        <Text className="text-xl font-bold text-gray-900 mt-4">Người dùng</Text>
        <Text className="text-gray-500 mt-1">ID: {userId}</Text>
      </View>

      {/* Actions */}
      <View className="bg-white flex-row justify-around py-4 mb-2">
        <TouchableOpacity className="items-center gap-1">
          <Text className="text-2xl">💬</Text>
          <Text className="text-xs text-gray-600">Nhắn tin</Text>
        </TouchableOpacity>
        <TouchableOpacity className="items-center gap-1">
          <Text className="text-2xl">📞</Text>
          <Text className="text-xs text-gray-600">Gọi điện</Text>
        </TouchableOpacity>
        <TouchableOpacity className="items-center gap-1">
          <Text className="text-2xl">📹</Text>
          <Text className="text-xs text-gray-600">Video call</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
