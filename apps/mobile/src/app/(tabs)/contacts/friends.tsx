import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/ui/Avatar";
import { CenterLoading, GrayToast } from "@/components/ui";
import { Friends, User } from "@/types";
import { friendsService, userService } from "@/services";
import { useAuthStore } from "@/stores";
import FriendsRequest from "@/components/ui/FriendsRequest";
import { Friend } from "@/components/ui/Friend";

export default function ContactsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [requestFriends, setRequestFriends] = useState<Friends[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const [listFriends, setListFriends] = useState<Friends[]>([]);
  const getFriendsRequests = async () => {
    try {
      const result = await friendsService.getPendingRequests(user!.id);

      const withUserInfo = await Promise.all(
        result.map(async (f: any) => {
          const fromUser = await userService.getUserById(String(f.fromUserId));
          return {
            ...f,
            fromUser,
          } as Friends;
        }),
      );

      setRequestFriends(withUserInfo);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách yêu cầu kết bạn:", error);
    }
  };

  const getListFriends = async () => {
    try {
      const result = await friendsService.getFriend(user!.id);

      const withUserInfo = await Promise.all(
        result.map(async (f: any) => {
          const friendUserId =
            String(f.fromUserId) === String(user!.id)
              ? String(f.toUserId)
              : String(f.fromUserId);

          const friendUser = await userService.getUserById(friendUserId);
          return {
            ...f,
            fromUser: friendUser,
          } as Friends;
        }),
      );

      setListFriends(withUserInfo);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách bạn bè:", error);
    }
  };

  useEffect(() => {
    if (user?.id) {
      getFriendsRequests();
      getListFriends();
    }
  }, [user?.id]);

  return (
    <View className="flex-1 bg-white">
      {/* Search */}

      {/* Quick actions */}
      <View className="border-b border-gray-100">
        <TouchableOpacity
          className="flex-row items-center px-4 py-3 gap-3"
          onPress={() => router.push("/friends/add")}
        >
          <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center">
            <Text>➕</Text>
          </View>
          <Text className="text-gray-900 font-medium">Thêm bạn</Text>
        </TouchableOpacity>
      </View>

      <CenterLoading visible={loading} />

      {/* Contacts list */}
      {requestFriends.length > 0 && (
        <FlatList
          data={requestFriends}
          keyExtractor={(item) => `${item.fromUserId}-${item.toUserId}`}
          renderItem={({ item }) => (
            <FriendsRequest
              request={item}
              onAccept={async (req) => {
                try {
                  setLoading(true);
                  await friendsService.acceptFriendRequest(
                    req.fromUserId,
                    req.toUserId,
                  );

                  setRequestFriends((prev) =>
                    prev.filter(
                      (r) =>
                        r.fromUserId !== req.fromUserId ||
                        r.toUserId !== req.toUserId,
                    ),
                  );

                  setListFriends((prev) => {
                    const existed = prev.some(
                      (f) =>
                        (f.fromUserId === req.fromUserId &&
                          f.toUserId === req.toUserId) ||
                        (f.fromUserId === req.toUserId &&
                          f.toUserId === req.fromUserId),
                    );

                    if (existed) return prev;

                    return [
                      {
                        ...req,
                        status: "accepted",
                        fromUser: req.fromUser,
                      },
                      ...prev,
                    ];
                  });

                  GrayToast("Kết bạn thành công");
                  await getListFriends();
                } catch (e) {
                  console.error("Lỗi chấp nhận:", e);
                } finally {
                  setLoading(false);
                }
              }}
              onReject={(req) => {
                setRequestFriends((prev) =>
                  prev.filter(
                    (r) =>
                      r.fromUserId !== req.fromUserId ||
                      r.toUserId !== req.toUserId,
                  ),
                );
              }}
            />
          )}
        />
      )}
      <View className="flex-1  justify-center">
        {listFriends.length === 0 ? (
          <Text className="text-gray-500">Bạn chưa có bạn bè nào</Text>
        ) : (
          <FlatList
            data={listFriends}
            keyExtractor={(item) => `${item.fromUserId}-${item.toUserId}`}
            renderItem={({ item }) => (
              <TouchableOpacity>
                <Friend
                  avatarUrl={item.fromUser?.avatarUrl}
                  name={item.fromUser?.fullName || "Unknown"}
                />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
}
