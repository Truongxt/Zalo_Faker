import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/ui/Avatar";
import { notificationsApi } from "@/services/notificationsApi";
import { useNotificationStore } from "@/stores/notificationStore";

const formatNotificationTime = (value: string) => {
  try {
    return new Date(value).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return value;
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    setLoading,
    setNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const result = await notificationsApi.getNotifications();
      setNotifications(result.notifications || [], result.unreadCount || 0);
    } catch (error) {
      console.warn("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setNotifications]);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications]),
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const handleOpenNotification = async (notificationId: string) => {
    const target = notifications.find(
      (notification) => notification.notificationId === notificationId,
    );
    if (!target) return;

    if (!target.isRead) {
      markAsRead(notificationId);
      try {
        await notificationsApi.markAsRead(notificationId);
      } catch (error) {
        console.warn("Failed to mark notification as read:", error);
      }
    }

    router.push("/(tabs)/moments");
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;

    markAllAsRead();
    try {
      await notificationsApi.markAllAsRead();
    } catch (error) {
      console.warn("Failed to mark all notifications as read:", error);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 py-4 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={goBack}>
          <Text className="text-2xl text-[#0068FF]">‹</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">Thông báo</Text>
          <Text className="text-xs text-gray-500">
            {unreadCount > 0
              ? `${unreadCount} thông báo chưa đọc`
              : "Bạn đã xem hết thông báo"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void handleMarkAllAsRead()}
          disabled={unreadCount === 0}
        >
          <Text
            className={`font-medium ${
              unreadCount === 0 ? "text-gray-300" : "text-[#0068FF]"
            }`}
          >
            Đọc hết
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading && notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0068FF" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.notificationId}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 32,
            flexGrow: notifications.length === 0 ? 1 : 0,
          }}
          onRefresh={() => void loadNotifications()}
          refreshing={isLoading}
          ListEmptyComponent={
            <View className="flex-1 bg-white rounded-2xl border border-gray-100 items-center justify-center px-6 py-12">
              <Text className="text-base font-semibold text-gray-900">
                Chưa có thông báo moment
              </Text>
              <Text className="text-sm text-gray-500 mt-2 text-center">
                Khi ai đó tương tác với khoảnh khắc hoặc bình luận của bạn, thông báo sẽ hiện ở đây.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => void handleOpenNotification(item.notificationId)}
              style={{
                backgroundColor: item.isRead ? "#FFFFFF" : "#EFF6FF",
                borderColor: item.isRead ? "#E5E7EB" : "#BFDBFE",
                borderWidth: 1,
                borderRadius: 18,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <Avatar
                  name={item.actorName || "U"}
                  uri={item.actorAvatarUrl}
                  size={44}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: "700",
                        color: "#111827",
                        paddingRight: 8,
                      }}
                    >
                      {item.title}
                    </Text>
                    {!item.isRead ? (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: "#2563EB",
                          marginTop: 4,
                        }}
                      />
                    ) : null}
                  </View>

                  {item.body ? (
                    <Text style={{ marginTop: 4, fontSize: 13, color: "#4B5563" }}>
                      {item.body}
                    </Text>
                  ) : null}

                  <Text style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
                    {formatNotificationTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
