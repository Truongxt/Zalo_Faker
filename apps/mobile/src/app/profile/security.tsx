import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";

export default function SecurityScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [accountLoading, setAccountLoading] = useState(false);

  const goBackSafe = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/profile");
  };

  const handleLockAccount = async () => {
    if (!user?.id || accountLoading) {
      return;
    }
    router.push("/profile/lock-account");
  };

  const handleDeleteAccount = async () => {
    if (!user?.id || accountLoading) {
      return;
    }

    router.push("/profile/delete-account");
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView>
        {/* Header */}
        <View className="bg-white px-4 py-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={goBackSafe}>
            <Text className="text-2xl">‹</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900">Bảo mật</Text>
        </View>

        {/* Security options */}
        <View className="bg-white mx-4 my-4 rounded-xl overflow-hidden">
          <TouchableOpacity
            onPress={() => router.push("/profile/change-password")}
            className="flex-row items-center px-4 py-3.5 gap-4 border-b border-gray-50"
            activeOpacity={0.7}
          >
            <Text className="text-xl">🔑</Text>
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">Đổi mật khẩu</Text>
              <Text className="text-xs text-gray-500 mt-1">
                Cập nhật mật khẩu để bảo mật tài khoản
              </Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/profile/login-history")}
            className="flex-row items-center px-4 py-3.5 gap-4 border-b border-gray-50"
            activeOpacity={0.7}
          >
            <Text className="text-xl">📋</Text>
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">
                Lịch sử đăng nhập
              </Text>
              <Text className="text-xs text-gray-500 mt-1">
                Xem thiết bị và thời gian đăng nhập gần đây
              </Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLockAccount}
            disabled={accountLoading}
            className="flex-row items-center px-4 py-3.5 gap-4 border-b border-gray-50"
            activeOpacity={0.7}
          >
            <Text className="text-xl">🔐</Text>
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">Khóa tài khoản</Text>
              <Text className="text-xs text-gray-500 mt-1">
                Tạm thời khóa tài khoản, có thể mở khóa lại sau
              </Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={accountLoading}
            className="flex-row items-center px-4 py-3.5 gap-4"
            activeOpacity={0.7}
          >
            <Text className="text-xl">🗑️</Text>
            <View className="flex-1">
              <Text className="text-red-600 font-medium">Xóa tài khoản</Text>
              <Text className="text-xs text-gray-500 mt-1">
                Xóa vĩnh viễn tài khoản và dữ liệu liên quan
              </Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
