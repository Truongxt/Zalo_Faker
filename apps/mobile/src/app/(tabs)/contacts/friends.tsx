import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { CenterLoading, GrayToast } from "@/components/ui";
import { Friends } from "@/types";
import { friendsService, userService } from "@/services";
import { useAuthStore } from "@/stores";
import FriendsRequest from "@/components/ui/FriendsRequest";
import { Friend } from "@/components/ui/Friend";

export default function ContactsScreen() {
  const router = useRouter();
  const [requestFriends, setRequestFriends] = useState<Friends[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const [listFriends, setListFriends] = useState<Friends[]>([]);

  const getFriendsRequests = useCallback(async () => {
    if (!user?.id) return;

    const result = await friendsService.getPendingRequests(user.id);
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
  }, [user?.id]);

  const getListFriends = useCallback(async () => {
    if (!user?.id) return;

    const result = await friendsService.getFriend(user.id);
    const withUserInfo = await Promise.all(
      result.map(async (f: any) => {
        const friendUserId =
          String(f.fromUserId) === String(user.id)
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
  }, [user?.id]);

  const loadAll = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      await Promise.all([getFriendsRequests(), getListFriends()]);
    } catch (error) {
      console.error("Loi khi tai danh sach ban be:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, getFriendsRequests, getListFriends]);

  useEffect(() => {
    if (!user?.id) return;
    loadAll();
  }, [user?.id, loadAll]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      loadAll();
    }, [user?.id, loadAll]),
  );

  return (
    <View className="flex-1 bg-white">
      <View className="border-b border-gray-100">
        <TouchableOpacity
          className="flex-row items-center px-4 py-3 gap-3"
          onPress={() => router.push("/friends/add")}
        >
          <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center">
            <Text>+</Text>
          </View>
          <Text className="text-gray-900 font-medium">Them ban</Text>
        </TouchableOpacity>
      </View>

      <CenterLoading visible={loading} />

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
                  await friendsService.acceptFriendRequest(req.fromUserId, req.toUserId);

                  setRequestFriends((prev) =>
                    prev.filter(
                      (r) => r.fromUserId !== req.fromUserId || r.toUserId !== req.toUserId,
                    ),
                  );

                  setListFriends((prev) => {
                    const existed = prev.some(
                      (f) =>
                        (f.fromUserId === req.fromUserId && f.toUserId === req.toUserId) ||
                        (f.fromUserId === req.toUserId && f.toUserId === req.fromUserId),
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

                  GrayToast("Ket ban thanh cong");
                  await getListFriends();
                } catch (e) {
                  console.error("Loi chap nhan:", e);
                } finally {
                  setLoading(false);
                }
              }}
              onReject={async (req) => {
                try {
                  setLoading(true);
                  await friendsService.rejectFriendRequest(String(req.fromUserId), String(req.toUserId));
                  setRequestFriends((prev) =>
                    prev.filter(
                      (r) => r.fromUserId !== req.fromUserId || r.toUserId !== req.toUserId,
                    ),
                  );
                  GrayToast("Da tu choi loi moi ket ban");
                } catch (e) {
                  console.error("Loi tu choi:", e);
                  GrayToast("Khong the tu choi loi moi");
                } finally {
                  setLoading(false);
                }
              }}
            />
          )}
        />
      )}

      <View className="flex-1 justify-center">
        {listFriends.length === 0 ? (
          <Text className="text-gray-500">Ban chua co ban be nao</Text>
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
