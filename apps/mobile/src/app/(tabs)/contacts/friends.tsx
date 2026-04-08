import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { CenterLoading, GrayToast } from "@/components/ui";
import { Friends } from "@/types";
import { friendsService, userService } from "@/services";
import { useAuthStore } from "@/stores";
import { useChatStore } from "@/stores/chatStore";
import FriendsRequest from "@/components/ui/FriendsRequest";
import { Friend } from "@/components/ui/Friend";
import { socketService } from "@/lib/socket";
import { chatService } from "@/services/chat";

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
        try {
          if (!f?.fromUserId) {
            return null;
          }
          const fromUser = await userService.getUserById(String(f.fromUserId));
          return {
            ...f,
            fromUser,
          } as Friends;
        } catch {
          return null;
        }
      }),
    );

    setRequestFriends(withUserInfo.filter(Boolean) as Friends[]);
  }, [user?.id]);

  const getListFriends = useCallback(async () => {
    if (!user?.id) return;

    const result = await friendsService.getFriend(user.id);
    const withUserInfo = await Promise.all(
      result.map(async (f: any) => {
        try {
          if (f?.fromUser?.id || f?.fromUser?.fullName) {
            return f as Friends;
          }

          if (!f?.fromUserId && !f?.toUserId) {
            return null;
          }

          const friendUserId =
            String(f.fromUserId) === String(user.id)
              ? String(f.toUserId)
              : String(f.fromUserId);

          if (!friendUserId || friendUserId === "undefined") {
            return null;
          }

          const friendUser = await userService.getUserById(friendUserId);
          return {
            ...f,
            fromUser: friendUser,
          } as Friends;
        } catch {
          return null;
        }
      }),
    );

    setListFriends(withUserInfo.filter(Boolean) as Friends[]);
  }, [user?.id]);

  const loadAll = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      await Promise.all([getFriendsRequests(), getListFriends()]);
    } catch (error) {
      console.warn("Loi khi tai danh sach ban be:", error);
      GrayToast("Khong the tai danh sach ban be");
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

  useEffect(() => {
    if (!user?.id) return;

    if (!socketService.getSocket()?.connected) {
      socketService.connect();
    }

    const removeByFriendId = (friendId: string) => {
      setListFriends((prev) =>
        prev.filter((f) => {
          const candidateId =
            String(f.fromUserId) === String(user.id)
              ? String(f.toUserId)
              : String(f.fromUserId);
          return String(candidateId) !== String(friendId);
        }),
      );
    };

    const handleFriendRemoved = ({ friendId }: { friendId: string }) => {
      removeByFriendId(friendId);
    };

    const handleFriendBlocked = ({ targetUserId }: { targetUserId: string }) => {
      removeByFriendId(targetUserId);
    };

    const handleBlockedBy = ({ blockedByUserId }: { blockedByUserId: string }) => {
      removeByFriendId(blockedByUserId);
      GrayToast("Ban da bi chan boi nguoi dung nay");
    };

    socketService.on("friend:removed", handleFriendRemoved);
    socketService.on("friend:blocked", handleFriendBlocked);
    socketService.on("friend:blocked_by", handleBlockedBy);

    return () => {
      socketService.off("friend:removed", handleFriendRemoved);
      socketService.off("friend:blocked", handleFriendBlocked);
      socketService.off("friend:blocked_by", handleBlockedBy);
    };
  }, [user?.id]);

  const getFriendUserId = (friend: Friends) =>
    String(friend.fromUserId) === String(user?.id)
      ? String(friend.toUserId)
      : String(friend.fromUserId);

  const handleOpenChat = async (friend: Friends) => {
    try {
      const friendId = getFriendUserId(friend);
      if (!friendId || friendId === "undefined") return;

      const existing = useChatStore
        .getState()
        .conversations.find(
          (c) =>
            c.type === "private" &&
            c.participants.some((p) => String(p.userId) === String(friendId)),
        );

      if (existing?.id) {
        router.push({
          pathname: "/(tabs)/chat/[conversationId]",
          params: { conversationId: String(existing.id) },
        });
        return;
      }

      const created = await chatService.createConversation([String(friendId)], "private");
      router.push({
        pathname: "/(tabs)/chat/[conversationId]",
        params: { conversationId: String(created.id) },
      });
    } catch (error) {
      console.warn("Khong the mo chat voi ban be:", error);
      GrayToast("Khong the mo cuoc tro chuyen");
    }
  };

  const handleRemoveFriend = async (friend: Friends) => {
    try {
      const friendId = getFriendUserId(friend);
      if (!friendId || friendId === "undefined") return;
      await friendsService.removeFriend(friendId);
      setListFriends((prev) => prev.filter((f) => getFriendUserId(f) !== friendId));
      GrayToast("Da huy ket ban");
    } catch (error) {
      console.warn("Khong the huy ket ban:", error);
      GrayToast("Khong the huy ket ban");
    }
  };

  const handleBlockFriend = async (friend: Friends) => {
    try {
      const friendId = getFriendUserId(friend);
      if (!friendId || friendId === "undefined") return;
      await friendsService.blockUser(friendId);
      setListFriends((prev) => prev.filter((f) => getFriendUserId(f) !== friendId));
      GrayToast("Da chan nguoi dung");
    } catch (error) {
      console.warn("Khong the chan ban be:", error);
      GrayToast("Khong the chan nguoi dung");
    }
  };

  const handleFriendActions = (friend: Friends) => {
    const friendName = friend.fromUser?.fullName || "Nguoi dung";
    Alert.alert(friendName, "Chon thao tac", [
      {
        text: "Nhan tin",
        onPress: () => {
          handleOpenChat(friend);
        },
      },
      {
        text: "Huy ket ban",
        style: "destructive",
        onPress: () => {
          Alert.alert("Xac nhan", `Huy ket ban voi ${friendName}?`, [
            { text: "Huy", style: "cancel" },
            { text: "Dong y", style: "destructive", onPress: () => handleRemoveFriend(friend) },
          ]);
        },
      },
      {
        text: "Chan",
        style: "destructive",
        onPress: () => {
          Alert.alert("Xac nhan", `Chan ${friendName}?`, [
            { text: "Huy", style: "cancel" },
            { text: "Dong y", style: "destructive", onPress: () => handleBlockFriend(friend) },
          ]);
        },
      },
      { text: "Dong", style: "cancel" },
    ]);
  };

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
              <TouchableOpacity
                onPress={() => handleOpenChat(item)}
                onLongPress={() => handleFriendActions(item)}
                delayLongPress={250}
              >
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
