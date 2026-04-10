import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { friendsService } from "@/services";
import { GrayToast } from "@/components/ui";

function Row({
  title,
  danger = false,
  onPress,
  right,
}: {
  title: string;
  danger?: boolean;
  onPress?: () => void;
  right?: ReactNode;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={!onPress}
      className="min-h-[68px] bg-white px-4 flex-row items-center justify-between border-b border-gray-200"
    >
      <Text
        className={`text-[16px] ${danger ? "text-[#EF4444]" : "text-[#1F2937]"}`}
      >
        {title}
      </Text>
      {right || null}
    </TouchableOpacity>
  );
}

export default function FriendOptionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, fullName } = useLocalSearchParams<{
    userId?: string;
    fullName?: string;
  }>();

  const [isBestFriend, setIsBestFriend] = useState(false);
  const [notifyMoments, setNotifyMoments] = useState(false);
  const [blockMyMoments, setBlockMyMoments] = useState(false);
  const [hideTheirMoments, setHideTheirMoments] = useState(false);

  const displayName = useMemo(
    () => String(fullName || "Người dùng"),
    [fullName],
  );

  const handleRemoveFriend = () => {
    const targetId = String(userId || "");
    if (!targetId) {
      GrayToast("Không tìm thấy người dùng");
      return;
    }

    Alert.alert(
      "Xóa bạn",
      `Bạn có chắc muốn xóa ${displayName} khỏi danh bạ?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await friendsService.removeFriend(targetId);
              GrayToast("Đã xóa bạn");
              router.replace("/(tabs)/contacts/friends");
            } catch (error) {
              console.warn("Khong the xoa ban:", error);
              GrayToast("Không thể xóa bạn lúc này");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#ECECF3]" edges={["top", "bottom"]}>
      <View
        style={{ paddingTop: Math.max(insets.top, 0) }}
        className="h-[58px] px-3 flex-row items-center bg-[#0A67DA]"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text
          className="ml-1 text-[20px] font-semibold text-white"
          numberOfLines={1}
        >
          {displayName}
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="mt-2">
          <Row
            title="Thông tin"
            onPress={() => GrayToast("Tính năng đang phát triển")}
          />
          <Row
            title="Đổi tên gợi nhớ"
            onPress={() => GrayToast("Tính năng đang phát triển")}
          />
          <Row
            title="Đánh dấu bạn thân"
            right={
              <Switch
                value={isBestFriend}
                onValueChange={setIsBestFriend}
                trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <Row
            title="Giới thiệu cho bạn bè"
            onPress={() => GrayToast("Tính năng đang phát triển")}
          />
        </View>

        <View className="mt-4 bg-white border-y border-gray-200">
          <View className="px-4 pt-3 pb-1">
            <Text className="text-[16px] font-semibold text-[#0A67DA]">
              Thông báo
            </Text>
          </View>
          <Row
            title="Nhận thông báo về hoạt động mới của người này"
            right={
              <Switch
                value={notifyMoments}
                onValueChange={setNotifyMoments}
                trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        <View className="mt-4 bg-white border-y border-gray-200">
          <View className="px-4 pt-3 pb-1">
            <Text className="text-[16px] font-semibold text-[#0A67DA]">
              Chặn và ẩn khỏi nhật ký
            </Text>
          </View>
          <Row
            title="Chặn xem hoạt động của tôi"
            right={
              <Switch
                value={blockMyMoments}
                onValueChange={setBlockMyMoments}
                trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <Row
            title="Ẩn hoạt động của người này"
            right={
              <Switch
                value={hideTheirMoments}
                onValueChange={setHideTheirMoments}
                trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        <View className="mt-4 bg-white border-y border-gray-200">
          <Row
            title="Báo xấu"
            onPress={() => GrayToast("Tính năng đang phát triển")}
          />
          <Row title="Xóa bạn" danger onPress={handleRemoveFriend} />
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
