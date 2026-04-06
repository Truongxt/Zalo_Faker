import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services";
import { Avatar } from "@/components/ui/Avatar";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshToken } = useAuthStore();

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          try {
            if (refreshToken) {
              await userService.logout(refreshToken);
            }
          } catch {
            // ignore logout errors
          } finally {
            logout();
            router.replace("/(auth)/login");
          }
        },
      },
    ]);
  };

  const menuItems = [
    { icon: "🔔", title: "Thông báo", onPress: () => {} },
    { icon: "🌙", title: "Giao diện", onPress: () => {} },
    {
      icon: "🔒",
      title: "Bảo mật",
      onPress: () => router.push("../profile/security"),
    },
    { icon: "💾", title: "Dữ liệu & Lưu trữ", onPress: () => {} },
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
