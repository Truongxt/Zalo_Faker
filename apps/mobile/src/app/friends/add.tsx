import { useEffect, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services";
import { CenterLoading, GrayToast } from "@/components/ui";

export default function AddFriend() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+84");
  const [loading, setLoading] = useState(false);

  const getUserByPhone = () => {
    if (loading) return;

    setLoading(true);

    setTimeout(async () => {
      try {
        console.log("timm kiem ", phoneNumber);
        const foundUser = await userService.getUserByPhone(phoneNumber);

        router.push({
          pathname: "/friends/UserSearchResult",
          params: { userId: String(foundUser.id) },
        });
        console.log("timm kiem ", foundUser);
      } catch (error) {
        GrayToast("Không tìm thấy người dùng");
        console.error("Error fetching user by phone:", error);
      } finally {
        setLoading(false);
      }
    }, 1000);
  };
  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <CenterLoading visible={loading} message="Đang tìm người dùng..." />
      <View className="h-14 px-4 flex-row items-center border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold">Thêm bạn</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* QR Code Section */}
        <View className="items-center py-6 px-4">
          <View className="bg-[#3E5A7D] rounded-2xl p-6 w-full max-w-sm items-center">
            <Text className="text-white text-lg font-semibold mb-4">
              {user?.fullName || "Việt Nhân"}
            </Text>

            {/* QR Code Placeholder */}
            <View className="bg-white rounded-2xl p-4 w-64 h-64 items-center justify-center">
              <View className="items-center">
                <View className="w-48 h-48 bg-gray-200 items-center justify-center rounded-lg">
                  <QRCode value={`userId:${user?.id ?? ""}`} size={200} />
                </View>
                <View className="absolute bottom-16 bg-black rounded-full w-12 h-12 items-center justify-center">
                  <Text className="text-white font-bold text-xs">
                    Dâij ka nhan
                  </Text>
                </View>
              </View>
            </View>

            <Text className="text-white text-sm mt-4 text-center">
              Quét mã để thêm bạn HIhihaha với tôi
            </Text>
          </View>
        </View>

        {/* Phone Input Section */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center border border-gray-300 rounded-lg overflow-hidden">
            <TouchableOpacity className="px-4 py-3 border-r border-gray-300 flex-row items-center">
              <Text className="text-base mr-1">{countryCode}</Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>

            <TextInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Nhập số điện thoại"
              keyboardType="phone-pad"
              className="flex-1 px-4 py-3 text-base"
            />

            {phoneNumber.length > 0 && (
              <TouchableOpacity
                className="px-4"
                onPress={getUserByPhone}
                disabled={loading}
              >
                <Ionicons
                  name="arrow-forward-circle"
                  size={28}
                  color="#0068FF"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Menu Items */}
        <View className="px-4 mb-4">
          <TouchableOpacity
            className="flex-row items-center py-4 border-b border-gray-200"
            onPress={() => router.push("/search/QRScanner" as Href)}
          >
            <View className="w-10 h-10 bg-blue-100 rounded-lg items-center justify-center mr-3">
              <Ionicons name="qr-code-outline" size={24} color="#0068FF" />
            </View>
            <Text className="text-base flex-1">Quét mã QR</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center py-4 border-b border-gray-200"
            onPress={() => router.push("/friends/suggestions" as Href)}
          >
            <View className="w-10 h-10 bg-purple-100 rounded-lg items-center justify-center mr-3">
              <Ionicons name="people-outline" size={24} color="#9333EA" />
            </View>
            <Text className="text-base flex-1">Bạn bè có thể quen</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Footer Link */}
        <View className="px-4 py-6">
          <TouchableOpacity
            onPress={() => {
              /* Handle view sent requests */
            }}
          >
            <Text className="text-sm text-gray-600 text-center">
              Xem lời mời kết bạn đã gửi tại trang Danh bạ Zalo
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
