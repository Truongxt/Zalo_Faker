import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { CenterLoading, GrayToast } from "@/components/ui";
import { MessageActionModal, type MessageActionItem } from "@/components/chat/MessageActionModal";
import { Friends } from "@/types";
import { friendsService, userService } from "@/services";
import { useAuthStore } from "@/stores";
import { useChatStore } from "@/stores/chatStore";
import { Avatar } from "@/components/ui/Avatar";
import { socketService } from "@/lib/socket";
import { chatService } from "@/services/chat";

type FilterMode = "all" | "new" | "online";

type FriendListDataItem =
  | { type: "header"; key: string; title: string }
  | { type: "friend"; key: string; friend: Friends; name: string };

export default function ContactsScreen() {
  const router = useRouter();
  const [requestFriends, setRequestFriends] = useState<Friends[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const [listFriends, setListFriends] = useState<Friends[]>([]);
  const [searchText, setSearchText] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [friendMenuTitle, setFriendMenuTitle] = useState("Tùy chọn");
  const [friendMenuOptions, setFriendMenuOptions] = useState<MessageActionItem[]>([]);
  const [showFriendMenu, setShowFriendMenu] = useState(false);

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

    const handleFriendRequestReceived = ({
      toUserId,
    }: {
      toUserId?: string | number;
    }) => {
      if (String(toUserId || "") !== String(user.id)) return;
      void getFriendsRequests();
      GrayToast("Ban vua nhan duoc loi moi ket ban");
    };

    const handleFriendRequestAccepted = ({
      fromUserId,
      toUserId,
    }: {
      fromUserId?: string | number;
      toUserId?: string | number;
    }) => {
      const myId = String(user.id);
      if (String(fromUserId || "") !== myId && String(toUserId || "") !== myId) return;
      void Promise.all([getFriendsRequests(), getListFriends()]);
      GrayToast("Danh sach ban be da duoc cap nhat");
    };

    const handleFriendRequestRejected = ({
      fromUserId,
      toUserId,
    }: {
      fromUserId?: string | number;
      toUserId?: string | number;
    }) => {
      const myId = String(user.id);
      if (String(fromUserId || "") !== myId && String(toUserId || "") !== myId) return;
      void getFriendsRequests();
    };

    socketService.on("friend:request_received", handleFriendRequestReceived);
    socketService.on("friend:request_accepted", handleFriendRequestAccepted);
    socketService.on("friend:request_rejected", handleFriendRequestRejected);

    return () => {
      socketService.off("friend:request_received", handleFriendRequestReceived);
      socketService.off("friend:request_accepted", handleFriendRequestAccepted);
      socketService.off("friend:request_rejected", handleFriendRequestRejected);
    };
  }, [user?.id, getFriendsRequests, getListFriends]);

  useEffect(() => {
    if (!user?.id) return;

    if (!socketService.getSocket()?.connected) {
      socketService.connect();
    }

    const applyPresenceForUser = (targetUserId: string, isOnline: boolean) => {
      setListFriends((prev) => {
        let changed = false;
        const next = prev.map((friend) => {
          const friendId = getFriendUserId(friend);
          if (String(friendId) !== String(targetUserId)) {
            return friend;
          }

          const currentStatus = friend.fromUser?.status;
          const nextStatus: "online" | "offline" = isOnline
            ? "online"
            : "offline";
          if (currentStatus === nextStatus) {
            return friend;
          }

          changed = true;

          return {
            ...friend,
            fromUser: friend.fromUser
              ? {
                  ...friend.fromUser,
                  status: nextStatus,
                }
              : friend.fromUser,
          };
        });

        return changed ? next : prev;
      });
    };

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

    const handleFriendBlocked = ({
      targetUserId,
    }: {
      targetUserId: string;
    }) => {
      removeByFriendId(targetUserId);
    };

    const handleBlockedBy = ({
      blockedByUserId,
    }: {
      blockedByUserId: string;
    }) => {
      removeByFriendId(blockedByUserId);
      GrayToast("Ban da bi chan boi nguoi dung nay");
    };

    const handlePresenceOnline = ({
      userId: onlineUserId,
    }: {
      userId: string;
    }) => {
      applyPresenceForUser(onlineUserId, true);
    };

    const handlePresenceOffline = ({
      userId: offlineUserId,
    }: {
      userId: string;
    }) => {
      applyPresenceForUser(offlineUserId, false);
    };

    const friendIds = listFriends
      .map((friend) => getFriendUserId(friend))
      .filter((id) => id && id !== "undefined");

    if (friendIds.length > 0) {
      socketService.emit(
        "presence:get_online_users",
        friendIds,
        (response: {
          success: boolean;
          onlineStatuses?: Record<string, boolean>;
        }) => {
          if (!response?.success || !response.onlineStatuses) {
            return;
          }

          setListFriends((prev) => {
            let changed = false;
            const next = prev.map((friend) => {
              const friendId = getFriendUserId(friend);
              const isOnline = response.onlineStatuses?.[String(friendId)];

              if (typeof isOnline !== "boolean") {
                return friend;
              }

              const currentStatus = friend.fromUser?.status;
              const nextStatus: "online" | "offline" = isOnline
                ? "online"
                : "offline";
              if (currentStatus === nextStatus) {
                return friend;
              }

              changed = true;

              return {
                ...friend,
                fromUser: friend.fromUser
                  ? {
                      ...friend.fromUser,
                      status: nextStatus,
                    }
                  : friend.fromUser,
              };
            });

            return changed ? next : prev;
          });
        },
      );
    }

    socketService.on("friend:removed", handleFriendRemoved);
    socketService.on("friend:blocked", handleFriendBlocked);
    socketService.on("friend:blocked_by", handleBlockedBy);
    socketService.on("presence:online", handlePresenceOnline);
    socketService.on("presence:offline", handlePresenceOffline);

    return () => {
      socketService.off("friend:removed", handleFriendRemoved);
      socketService.off("friend:blocked", handleFriendBlocked);
      socketService.off("friend:blocked_by", handleBlockedBy);
      socketService.off("presence:online", handlePresenceOnline);
      socketService.off("presence:offline", handlePresenceOffline);
    };
  }, [user?.id, listFriends]);

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

      const created = await chatService.createConversation(
        [String(friendId)],
        "private",
      );
      router.push({
        pathname: "/(tabs)/chat/[conversationId]",
        params: { conversationId: String(created.id) },
      });
    } catch (error) {
      console.warn("Khong the mo chat voi ban be:", error);
      GrayToast("Khong the mo cuoc tro chuyen");
    }
  };

  const handleOpenFriendProfile = (friend: Friends) => {
    const friendId = getFriendUserId(friend);
    if (!friendId || friendId === "undefined") {
      GrayToast("Khong the mo trang ca nhan");
      return;
    }

    router.push({
      pathname: "/profile/[userId]",
      params: { userId: String(friendId) },
    });
  };

  const handleRemoveFriend = async (friend: Friends) => {
    try {
      const friendId = getFriendUserId(friend);
      if (!friendId || friendId === "undefined") return;
      await friendsService.removeFriend(friendId);
      setListFriends((prev) =>
        prev.filter((f) => getFriendUserId(f) !== friendId),
      );
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
      setListFriends((prev) =>
        prev.filter((f) => getFriendUserId(f) !== friendId),
      );
      GrayToast("Da chan nguoi dung");
    } catch (error) {
      console.warn("Khong the chan ban be:", error);
      GrayToast("Khong the chan nguoi dung");
    }
  };

  const handleFriendActions = (friend: Friends) => {
    const friendName = friend.fromUser?.fullName || "Nguoi dung";
    setFriendMenuTitle(friendName);
    setFriendMenuOptions([
      {
        key: "message",
        text: "Nhan tin",
        onPress: () => {
          handleOpenChat(friend);
        },
      },
      {
        key: "remove-friend",
        text: "Huy ket ban",
        style: "destructive",
        onPress: () => {
          Alert.alert("Xac nhan", `Huy ket ban voi ${friendName}?`, [
            { text: "Huy", style: "cancel" },
            {
              text: "Dong y",
              style: "destructive",
              onPress: () => handleRemoveFriend(friend),
            },
          ]);
        },
      },
      {
        key: "block",
        text: "Chan",
        style: "destructive",
        onPress: () => {
          Alert.alert("Xac nhan", `Chan ${friendName}?`, [
            { text: "Huy", style: "cancel" },
            {
              text: "Dong y",
              style: "destructive",
              onPress: () => handleBlockFriend(friend),
            },
          ]);
        },
      },
      { key: "close", text: "Dong", style: "cancel" },
    ]);
    setShowFriendMenu(true);
  };

  const getDisplayName = (friend: Friends) =>
    String(friend.fromUser?.fullName || "Unknown").trim();

  const isNewFriend = (friend: Friends) => {
    const createdAt = new Date(friend.createdAt || 0).getTime();
    if (!createdAt) return false;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - createdAt <= sevenDaysMs;
  };

  const isOnlineFriend = (friend: Friends) => {
    const status = String(friend.fromUser?.status || "offline").toLowerCase();
    return status === "online";
  };

  const filteredFriends = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return listFriends.filter((friend) => {
      if (filterMode === "new" && !isNewFriend(friend)) return false;
      if (filterMode === "online" && !isOnlineFriend(friend)) return false;

      if (!keyword) return true;

      const name = getDisplayName(friend).toLowerCase();
      return name.includes(keyword);
    });
  }, [listFriends, filterMode, searchText]);

  const groupedListData = useMemo<FriendListDataItem[]>(() => {
    const sorted = [...filteredFriends].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b), "vi", {
        sensitivity: "base",
      }),
    );

    const grouped = new Map<string, Array<{ friend: Friends; name: string }>>();

    sorted.forEach((friend) => {
      const name = getDisplayName(friend);
      const firstChar = name.charAt(0).toUpperCase();
      const groupKey = /[A-ZÀ-Ỹ]/.test(firstChar) ? firstChar : "#";

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }

      grouped.get(groupKey)?.push({ friend, name });
    });

    const data: FriendListDataItem[] = [];
    Array.from(grouped.keys())
      .sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }))
      .forEach((groupKey) => {
        data.push({
          type: "header",
          key: `header-${groupKey}`,
          title: groupKey,
        });

        grouped.get(groupKey)?.forEach(({ friend, name }) => {
          data.push({
            type: "friend",
            key: `friend-${friend.fromUserId}-${friend.toUserId}`,
            friend,
            name,
          });
        });
      });

    return data;
  }, [filteredFriends]);

  const newFriendCount = useMemo(
    () => listFriends.filter((friend) => isNewFriend(friend)).length,
    [listFriends],
  );

  const onlineFriendCount = useMemo(
    () => listFriends.filter((friend) => isOnlineFriend(friend)).length,
    [listFriends],
  );

  const renderFriendRow = (friend: Friends, name: string) => (
    <TouchableOpacity
      onPress={() => handleOpenFriendProfile(friend)}
      onLongPress={() => handleFriendActions(friend)}
      delayLongPress={250}
      activeOpacity={0.8}
      className="flex-row items-center px-4 py-3"
    >
      <Avatar uri={friend.fromUser?.avatarUrl} name={name} size={52} />

      <View className="ml-3 flex-1">
        <Text className="text-[15px] font-medium text-gray-900">{name}</Text>
        <Text
          className={`mt-0.5 text-[12px] ${
            isOnlineFriend(friend) ? "text-green-600" : "text-gray-500"
          }`}
        >
          {isOnlineFriend(friend) ? "Đang online" : "Offline"}
        </Text>
      </View>

      <TouchableOpacity
        className="mr-4 h-9 w-9 items-center justify-center"
        onPress={() => handleOpenChat(friend)}
      >
        <Ionicons name="call-outline" size={24} color="#4B5563" />
      </TouchableOpacity>

      <TouchableOpacity
        className="h-9 w-9 items-center justify-center"
        onPress={() => GrayToast("Tinh nang goi video dang phat trien")}
      >
        <Ionicons name="videocam-outline" size={24} color="#4B5563" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-[#F3F4F6]">
      <View className="px-4 pt-3 pb-2 bg-white border-b border-gray-200">
        <View className="h-11 rounded-full bg-[#EEF2FF] px-4 flex-row items-center">
          <Ionicons name="search-outline" size={20} color="#6B7280" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm bạn bè"
            className="ml-2 flex-1 text-base text-gray-900"
          />
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="bg-white mt-2">
          <TouchableOpacity
            onPress={() => router.push("/friends/pending")}
            className="flex-row items-center px-4 py-4 border-b border-gray-100"
          >
            <View className="h-12 w-12 rounded-2xl bg-blue-100 items-center justify-center">
              <Ionicons name="person-add" size={24} color="#2563EB" />
            </View>
            <Text className="ml-3 text-[17px] font-medium text-gray-900">
              Lời mời kết bạn ({requestFriends.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => GrayToast("Muc sinh nhat se duoc cap nhat sau")}
            className="flex-row items-center px-4 py-4 border-b border-gray-100"
          >
            <View className="h-12 w-12 rounded-2xl bg-blue-100 items-center justify-center">
              <Ionicons name="gift-outline" size={24} color="#2563EB" />
            </View>
            <Text className="ml-3 text-[17px] font-medium text-gray-900">
              Sinh nhật
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/friends/suggestions")}
            className="flex-row items-center px-4 py-4"
          >
            <View className="h-12 w-12 rounded-2xl bg-blue-100 items-center justify-center">
              <Ionicons name="phone-portrait-outline" size={24} color="#2563EB" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[17px] font-medium text-gray-900">
                Gợi ý từ danh bạ điện thoại
              </Text>
              <Text className="mt-0.5 text-[13px] text-gray-500">
                Đồng bộ danh bạ để tìm bạn đã dùng app
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View className="mt-2 border-y border-gray-200 bg-white px-3 py-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              className={`mr-2 rounded-full px-4 py-2 border ${
                filterMode === "all"
                  ? "bg-[#E5E7EB] border-[#E5E7EB]"
                  : "bg-white border-gray-200"
              }`}
              onPress={() => setFilterMode("all")}
            >
              <Text className="text-[14px] text-gray-800">
                Tất cả {listFriends.length}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`mr-2 rounded-full px-4 py-2 border ${
                filterMode === "new"
                  ? "bg-[#E5E7EB] border-[#E5E7EB]"
                  : "bg-white border-gray-200"
              }`}
              onPress={() => setFilterMode("new")}
            >
              <Text className="text-[14px] text-gray-800">
                Bạn mới {newFriendCount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`rounded-full px-4 py-2 border ${
                filterMode === "online"
                  ? "bg-[#E5E7EB] border-[#E5E7EB]"
                  : "bg-white border-gray-200"
              }`}
              onPress={() => setFilterMode("online")}
            >
              <Text className="text-[14px] text-gray-800">
                Đang online {onlineFriendCount}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View className="bg-white mt-2 border-t border-gray-200">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="star" size={18} color="#EAB308" />
              <Text className="ml-2 text-[18px] font-semibold text-gray-900">
                Bạn thân
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => GrayToast("Tính năng đang phát triển")}
            >
              <Text className="text-[16px] font-semibold text-[#0A67DA]">
                + Thêm
              </Text>
            </TouchableOpacity>
          </View>

          {groupedListData.length === 0 ? (
            <View className="px-4 py-8">
              <Text className="text-center text-base text-gray-500">
                Không có bạn bè phù hợp
              </Text>
            </View>
          ) : (
            groupedListData.map((item) => {
              if (item.type === "header") {
                return (
                  <View
                    key={item.key}
                    className="px-4 py-2 bg-[#F9FAFB] border-t border-gray-100"
                  >
                    <Text className="text-[14px] font-semibold text-gray-700">
                      {item.title}
                    </Text>
                  </View>
                );
              }

              return (
                <View key={item.key} className="border-b border-gray-50">
                  {renderFriendRow(item.friend, item.name)}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <CenterLoading visible={loading} />
      <MessageActionModal
        visible={showFriendMenu}
        title={friendMenuTitle}
        options={friendMenuOptions}
        onClose={() => setShowFriendMenu(false)}
      />
    </View>
  );
}
