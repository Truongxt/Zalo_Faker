import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, CenterLoading, GrayToast } from "@/components/ui";
import type { Friends } from "@/types";
import { friendsService, userService } from "@/services";
import { useAuthStore } from "@/stores";
import { socketService } from "@/lib/socket";

export default function PendingFriendRequestsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Friends[]>([]);

  const loadRequests = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const result = await friendsService.getPendingRequests(String(user.id));
      const withUserInfo = await Promise.all(
        result.map(async (f: any) => {
          try {
            if (!f?.fromUserId) return null;
            const fromUser = await userService.getUserById(
              String(f.fromUserId),
            );
            return {
              ...f,
              fromUser,
            } as Friends;
          } catch {
            return null;
          }
        }),
      );

      setRequests(withUserInfo.filter(Boolean) as Friends[]);
    } catch (error) {
      console.warn("Lỗi tải danh sách lời mời kết bạn:", error);
      GrayToast("Không thể tải lời mời kết bạn");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!user?.id) return;

    if (!socketService.getSocket()?.connected) {
      socketService.connect();
    }

    const refreshOnFriendEvent = ({
      fromUserId,
      toUserId,
    }: {
      fromUserId?: string | number;
      toUserId?: string | number;
    }) => {
      const myId = String(user.id);
      if (
        String(fromUserId || "") !== myId &&
        String(toUserId || "") !== myId
      ) {
        return;
      }
      void loadRequests();
    };

    socketService.on("friend:request_received", refreshOnFriendEvent);
    socketService.on("friend:request_accepted", refreshOnFriendEvent);
    socketService.on("friend:request_rejected", refreshOnFriendEvent);

    return () => {
      socketService.off("friend:request_received", refreshOnFriendEvent);
      socketService.off("friend:request_accepted", refreshOnFriendEvent);
      socketService.off("friend:request_rejected", refreshOnFriendEvent);
    };
  }, [loadRequests, user?.id]);

  const pendingCount = useMemo(() => requests.length, [requests]);

  const handleAccept = async (request: Friends) => {
    try {
      await friendsService.acceptFriendRequest(
        String(request.fromUserId),
        String(request.toUserId),
      );
      setRequests((prev) => prev.filter((item) => item.id !== request.id));
      GrayToast("Đã chấp nhận lời mời kết bạn");
    } catch (error) {
      console.warn("Lỗi chấp nhận lời mời kết bạn: ", error);
      GrayToast("Không thể chấp nhận lời mời");
    }
  };

  const handleReject = async (request: Friends) => {
    Alert.alert("Từ chối lời mời", "Bạn có muốn từ chối lời mời này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Từ chối",
        style: "destructive",
        onPress: async () => {
          try {
            await friendsService.rejectFriendRequest(
              String(request.fromUserId),
              String(request.toUserId),
            );
            setRequests((prev) =>
              prev.filter((item) => item.id !== request.id),
            );
            GrayToast("Đã từ chối lời mời");
          } catch (error) {
            console.warn("Lỗi từ chối lời mời kết bạn:", error);
            GrayToast("Không thể từ chối lời mời");
          }
        },
      },
    ]);
  };

  const handleOpenProfile = (request: Friends) => {
    const fromUserId = String(request.fromUserId || "");
    if (!fromUserId) return;

    router.push({
      pathname: "/profile/[userId]",
      params: { userId: fromUserId },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F3F4F6]" edges={["top", "bottom"]}>
      <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-[18px] font-semibold text-gray-900">
          Lời mời kết bạn ({pendingCount})
        </Text>
      </View>

      {loading ? (
        <CenterLoading visible={true} message="Đang tải lời mời kết bạn..." />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ListEmptyComponent={
            <View className="bg-white rounded-2xl px-4 py-8 mt-3">
              <Text className="text-center text-gray-500 text-[15px]">
                Bạn không có lời mời kết bạn nào
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const name = String(item.fromUser?.fullName || "Nguoi dung");
            return (
              <View className="bg-white rounded-2xl px-4 py-3 mb-3 border border-gray-100">
                <TouchableOpacity
                  onPress={() => handleOpenProfile(item)}
                  activeOpacity={0.8}
                  className="flex-row items-center"
                >
                  <Avatar
                    uri={item.fromUser?.avatarUrl || undefined}
                    name={name}
                    size={52}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-[16px] font-medium text-gray-900">
                      {name}
                    </Text>
                    <Text
                      className="text-[13px] text-gray-500 mt-1"
                      numberOfLines={2}
                    >
                      {item.message || "Da gui loi moi ket ban cho ban"}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View className="mt-3 flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => handleReject(item)}
                    className="flex-1 h-10 rounded-xl bg-gray-100 items-center justify-center"
                  >
                    <Text className="text-[14px] font-medium text-gray-700">
                      Từ chối
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleAccept(item)}
                    className="flex-1 h-10 rounded-xl bg-[#0A67DA] items-center justify-center"
                  >
                    <Text className="text-[14px] font-medium text-white">
                      Đồng ý
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
