import { View, Text } from "react-native";
import { Avatar } from "./Avatar";

interface FriendProps {
  avatarUrl?: string | null;
  name: string;
  status?: "online" | "offline";
}

export function Friend({ avatarUrl, name, status = "offline" }: FriendProps) {
  const isOnline = status === "online";

  return (
    <View className="flex-row items-center px-5 py-3">
      <Avatar uri={avatarUrl} name={name} size={48} />
      <View className="ml-3 flex-1">
        <Text className="text-base font-medium text-gray-900">{name}</Text>
        <View className="mt-1 flex-row items-center">
          <View
            className={`h-2.5 w-2.5 rounded-full ${
              isOnline ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          <Text className="ml-2 text-xs text-gray-500">
            {isOnline ? "Dang hoat dong" : "Ngoai tuyen"}
          </Text>
        </View>
      </View>
    </View>
  );
}
