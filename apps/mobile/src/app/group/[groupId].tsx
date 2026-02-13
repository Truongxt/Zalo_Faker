import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  return (
    <View className="flex-1 bg-white items-center justify-center">
      <Text className="text-gray-500">Chi tiết nhóm: {groupId}</Text>
      {/* TODO: Implement group detail/settings */}
    </View>
  );
}
