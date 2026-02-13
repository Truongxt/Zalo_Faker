import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function CallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();

  return (
    <View className="flex-1 bg-gray-900 items-center justify-center">
      <Text className="text-white text-xl">Đang gọi...</Text>
      {/* TODO: Implement WebRTC call UI */}
    </View>
  );
}
