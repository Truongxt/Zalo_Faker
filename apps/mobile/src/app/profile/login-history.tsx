import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services";
import type { LoginHistoryItem } from "@/types";

const platformLabel = (platform: string) => {
  switch (platform) {
    case "mobile":
      return "📱 Mobile";
    case "web":
      return "💻 Web";
    default:
      return "❓ Không xác định";
  }
};

const formatDate = (isoString: string) => {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const timeAgo = (isoString: string) => {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return formatDate(isoString);
};

export default function LoginHistoryScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [history, setHistory] = useState<LoginHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { logout } = useAuthStore();

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await userService.getLoginHistory(user.id, 50);
      setHistory(data);
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || err?.message || "Không tải được lịch sử đăng nhập";

      console.error("Failed to load login history:", message);

      if (status === 401) {
        Alert.alert("Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại", [
          {
            text: "OK",
            onPress: () => {
              logout();
              router.replace("/(auth)/login");
            },
          },
        ]);
        return;
      }

      if (status === 403) {
        Alert.alert("Không có quyền", "Bạn chỉ có thể xem lịch sử đăng nhập của chính mình");
        return;
      }

      Alert.alert("Lỗi", message);
    }
  }, [user?.id, logout, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [fetchHistory]);

  useEffect(() => {
    setLoading(true);
    fetchHistory().finally(() => setLoading(false));
  }, [fetchHistory]);

  const goBackSafe = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/profile/security");
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 py-4 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={goBackSafe}>
          <Text className="text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">
          Lịch sử đăng nhập
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0068FF" />
          <Text className="text-gray-500 mt-3">Đang tải...</Text>
        </View>
      ) : history.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">📋</Text>
          <Text className="text-gray-500 text-center">
            Chưa có lịch sử đăng nhập nào
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Summary card */}
          <View className="bg-blue-50 mx-4 mt-4 p-4 rounded-xl border border-blue-100">
            <Text className="text-blue-800 font-semibold text-sm">
              📊 Tổng cộng {history.length} lần đăng nhập
            </Text>
            <Text className="text-blue-600 text-xs mt-1">
              Kéo xuống để xem chi tiết từng phiên
            </Text>
          </View>

          {/* History list */}
          <View className="mx-4 my-4">
            {history.map((item, index) => (
              <View
                key={item.loginId}
                className={`bg-white rounded-xl p-4 mb-3 border border-gray-100 ${
                  index === 0 ? "border-blue-200 bg-blue-50" : ""
                }`}
              >
                {/* Top row: platform + time ago */}
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-semibold">
                      {platformLabel(item.platform)}
                    </Text>
                    {index === 0 && (
                      <View className="bg-green-100 px-2 py-0.5 rounded-full">
                        <Text className="text-green-700 text-xs font-medium">
                          Gần nhất
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-gray-400">
                    {timeAgo(item.loginAt)}
                  </Text>
                </View>

                {/* Device info */}
                <View className="flex-row items-center gap-2 mb-1.5">
                  <Text className="text-gray-400 text-xs">🖥️</Text>
                  <Text className="text-gray-600 text-sm flex-1" numberOfLines={2}>
                    {item.deviceInfo}
                  </Text>
                </View>

                {/* Time */}
                <View className="flex-row items-center gap-2 mb-1.5">
                  <Text className="text-gray-400 text-xs">🕐</Text>
                  <Text className="text-gray-600 text-sm">
                    {formatDate(item.loginAt)}
                  </Text>
                </View>

                {/* IP */}
                <View className="flex-row items-center gap-2">
                  <Text className="text-gray-400 text-xs">🌐</Text>
                  <Text className="text-gray-500 text-xs font-mono">
                    IP: {item.ipAddress}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Footer note */}
          <View className="px-4 pb-8">
            <Text className="text-gray-400 text-xs text-center">
              Nếu phát hiện đăng nhập lạ, hãy đổi mật khẩu ngay
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
