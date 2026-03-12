import { View, Text, TouchableOpacity } from "react-native";
import { Avatar } from "./Avatar";
import type { Friends } from "@/types";

interface FriendsRequestProps {
  request: Friends;
  onAccept: (request: Friends) => void;
  onReject: (request: Friends) => void;
}

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

export default function FriendsRequest({
  request,
  onAccept,
  onReject,
}: FriendsRequestProps) {
  const { fromUser, message, createdAt } = request;

  if (!fromUser) return null;

  return (
    <View className="bg-white px-4 py-4 border-b border-gray-100">
      {/* Header: Avatar + Name + Time */}
      <View className="flex-row items-center mb-3">
        <Avatar name={fromUser.fullName} uri={fromUser.avatarUrl} size={50} />
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-gray-900">
            {fromUser.fullName}
          </Text>
          <Text className="text-sm text-gray-500">
            {getTimeAgo(createdAt)} • Muốn kết bạn
          </Text>
        </View>
      </View>

      {/* Message bubble */}
      {message ? (
        <View className="bg-gray-100 rounded-xl px-4 py-3 mb-4 ml-2">
          <Text className="text-base text-gray-800">{message}</Text>
        </View>
      ) : null}

      {/* Action buttons */}
      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => onReject(request)}
          className="flex-1 py-3 rounded-lg bg-gray-100 items-center"
        >
          <Text className="text-base font-semibold text-gray-700">BỎ QUA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onAccept(request)}
          className="flex-1 py-3 rounded-lg bg-blue-50 items-center border border-blue-400"
        >
          <Text className="text-base font-semibold text-blue-600">ĐỒNG Ý</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
