import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/ui";
import type { User } from "@/types";
import { friendsService, userService } from "@/services";
import { useAuthStore } from "@/stores";
import { CenterLoading } from "@/components/ui";
import { GrayToast } from "@/components/ui";

export default function SendFriendRequest() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const param = useLocalSearchParams();
  const { user } = useAuthStore();
  const [blockedViewActivity, setBlockedViewActivity] = useState(false);
  const [friend, setFriend] = useState<User>();
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(
    "Xin chào, mình muốn kết bạn với bạn trên Hihihehe!",
  );

  const fetchUser = async () => {
    try {
      if (!param.userId) {
        console.error("No userId provided");
        router.back();
        return;
      }
      const friend1: User = await userService.getUserById(
        param.userId as string,
      );
      setFriend(friend1);
    } catch (error) {
      console.error("Error fetching user:", error);
      GrayToast("Không tìm thấy người dùng");
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      fetchUser();
    }, 1000);
  }, [param.userId]);

  const handleSendRequest = async () => {
    try {
      console.log("Gửi lời mời với message:", message);
      await friendsService.sendFriendRequests(
        String(user!.id),
        String(friend!.id),
        message,
      );
      router.push({
        pathname: "/(tabs)/chat/[conversationId]",
        params: { conversationId: String(friend!.id) },
      });
    } catch (error: any) {
      if (error?.response?.status === 409) {
        GrayToast("Bạn đã gửi lời mời kết bạn đến người này rồi");
      } else {
        GrayToast("Gửi lời mời kết bạn thất bại");
        console.error("Lỗi gửi lời mời kết bạn:", error);
      }
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Blue Header */}
      <CenterLoading visible={isLoading} message="Đang tìm người dùng..." />
      <View
        className="bg-blue-500 px-4 py-4"
        style={{ paddingTop: insets.top }}
      >
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-semibold">Kết bạn</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-gray-50"
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Card */}
        <View className="bg-white px-4 py-6 border-b border-gray-200">
          <View className="flex-row items-center mb-6">
            <Avatar name={friend?.fullName ?? "bạn"} size={80} />
            <View className="ml-4 flex-1">
              <View className="flex-row items-center">
                <Text className="text-2xl font-bold text-gray-900">
                  {friend?.fullName ?? "bạn"}
                </Text>
                <TouchableOpacity className="ml-2">
                  <Ionicons name="create-outline" size={20} color="#999" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View className="border-t border-gray-200 pt-4">
            <Text className="text-sm text-gray-600">Lời nhắn</Text>
          </View>
        </View>

        {/* Message Input */}
        <View className="bg-white px-4 py-4 border-b border-gray-200">
          <View className="bg-gray-100 rounded-lg px-3 py-2 flex-row items-center">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Nhập lời nhắn..."
              multiline
              maxLength={150}
              className="flex-1 text-base text-gray-900"
              style={{ minHeight: 80 }}
            />
            {message.length > 0 && (
              <TouchableOpacity className="ml-2">
                <Ionicons name="close" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          <Text className="text-xs text-gray-500 text-right mt-2">
            {message.length}/150
          </Text>
        </View>

        {/* Block View Activity Toggle */}
        <View className="bg-white px-4 py-4 border-b border-gray-200">
          <View className="flex-row items-center justify-between">
            <Text className="text-base text-gray-900 flex-1">
              Chặn người này xem hoạt động của tôi
            </Text>
            <Switch
              value={blockedViewActivity}
              onValueChange={setBlockedViewActivity}
              trackColor={{ false: "#e5e7eb", true: "#bfdbfe" }}
              thumbColor={blockedViewActivity ? "#0068FF" : "#f3f4f6"}
            />
          </View>
        </View>

        <View className="flex-1" />
      </ScrollView>

      {/* Send Button */}
      <SafeAreaView
        edges={["bottom"]}
        className="bg-white border-t border-gray-200"
      >
        <View className="px-4 py-4">
          <TouchableOpacity
            onPress={handleSendRequest}
            disabled={isLoading || !friend}
            className={`rounded-full py-3 items-center ${
              isLoading || !friend ? "bg-gray-300" : "bg-blue-500"
            }`}
          >
            <Text
              className={`font-semibold text-base ${
                isLoading || !friend ? "text-gray-600" : "text-white"
              }`}
            >
              {isLoading ? "ĐANG GỬI..." : "GỬI YÊU CẦU"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
