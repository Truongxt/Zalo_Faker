import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRef } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services";
import { Avatar } from "@/components/ui/Avatar";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshToken } = useAuthStore();
  const isLoggingOutRef = useRef(false);

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          if (isLoggingOutRef.current) {
            return;
          }

          isLoggingOutRef.current = true;
          const tokenToRevoke = refreshToken;

          // Always clear local auth state immediately for responsive UX.
          logout();
          router.replace("/(auth)/login");

          try {
            if (tokenToRevoke) {
              await userService.logout(tokenToRevoke);
            }
          } catch {
            // Ignore revoke errors because user is already logged out locally.
          }
        },
      },
    ]);
  };

  const menuItems = [
    { icon: "🔔", title: "Thông báo", onPress: () => router.push("/profile/notifications") },
    { icon: "🌙", title: "Giao diện", onPress: () => router.push("/profile/appearance") },
    {
      icon: "🔒",
      title: "Bảo mật",
      onPress: () => router.push("/profile/security"),
    },
    { icon: "💾", title: "Dữ liệu & Lưu trữ", onPress: () => router.push("/profile/data-storage") },
    { icon: "❓", title: "Trợ giúp", onPress: () => {} },
    { icon: "ℹ️", title: "Về ứng dụng", onPress: () => {} },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Profile card */}
      <TouchableOpacity
        className="bg-white p-4 flex-row items-center gap-4 mb-2"
        activeOpacity={0.7}
        onPress={() => router.push(`/profile/${user?.id}`)}
      >
        <Avatar name={user?.fullName || "?"} uri={user?.avatarUrl} size={60} />
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">
            {user?.fullName}
          </Text>
          <Text className="text-sm text-gray-500">{user?.email}</Text>
        </View>
        <Text className="text-gray-400 text-lg">›</Text>
      </TouchableOpacity>

      {/* Menu items */}
      <View className="bg-white mb-2">
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            onPress={item.onPress}
            className="flex-row items-center px-4 py-3.5 gap-4 border-b border-gray-50"
            activeOpacity={0.7}
          >
            <Text className="text-xl">{item.icon}</Text>
            <Text className="flex-1 text-gray-900">{item.title}</Text>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity
        onPress={handleLogout}
        className="bg-white mx-4 my-4 py-3.5 rounded-xl items-center"
        activeOpacity={0.7}
      >
        <Text className="text-red-500 font-semibold">Đăng xuất</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
