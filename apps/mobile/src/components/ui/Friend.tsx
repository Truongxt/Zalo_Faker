import { View, Text } from "react-native";
import { Avatar } from "./Avatar";

interface FriendProps {
  avatarUrl?: string | null;
  name: string;
}

export function Friend({ avatarUrl, name }: FriendProps) {
  return (
    <View className="flex-row items-center px-5 py-3">
      <Avatar uri={avatarUrl} name={name} size={48} />
      <Text className="ml-3 text-base font-medium text-gray-900">{name}</Text>
    </View>
  );
}
