import { View, Text, TouchableOpacity } from "react-native";

export default function GroupsScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center">
      <TouchableOpacity className="flex-row items-center px-4 py-3 gap-3">
        <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
          <Text>👥</Text>
        </View>
        <Text className="text-gray-900 font-medium">Tạo nhóm mới</Text>
      </TouchableOpacity>
      <Text className="text-gray-500 text-base">Chưa có nhóm nào</Text>
    </View>
  );
}
