import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  FlatList,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, CenterLoading, GrayToast } from "@/components/ui";
import type { SuggestedFriend } from "@/services/friendsService";
import { contactSuggestionsService } from "@/services/contactSuggestionsService";
import { useAuthStore } from "@/stores";

type SyncOptions = {
  force?: boolean;
  silent?: boolean;
  requestPermission?: boolean;
};

export default function FriendSuggestions() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedFriend[]>([]);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const syncingRef = useRef(false);

  const runSync = useCallback(
    async ({ force = false, silent = false, requestPermission = false }: SyncOptions = {}) => {
      if (!user?.id || syncingRef.current) {
        return;
      }

      syncingRef.current = true;
      setIsSyncing(true);

      try {
        const result = await contactSuggestionsService.syncSuggestions({
          userId: String(user.id),
          force,
          requestPermission,
        });

        setSuggestions(result.suggestions || []);
        setPermissionDenied(result.status === "no_permission");

        if (!silent) {
          if (result.status === "no_permission") {
            GrayToast("Bạn cần cấp quyền danh bạ để tìm bạn");
          } else if (result.status === "updated") {
            GrayToast(
              result.suggestions.length
                ? `Đã cập nhật ${result.suggestions.length} gợi ý từ danh bạ`
                : "Chưa tìm thấy bạn bè nào từ danh bạ",
            );
          } else if (force) {
            GrayToast("Danh bạ chưa thay đổi");
          }
        }
      } catch (error) {
        console.warn("Failed to sync contact suggestions:", error);
        if (!silent) {
          GrayToast("Đồng bộ danh bạ thất bại");
        }
      } finally {
        setIsSyncing(false);
        syncingRef.current = false;
      }
    },
    [user?.id],
  );

  useEffect(() => {
    if (!user?.id) {
      setSuggestions([]);
      setPermissionDenied(false);
      return;
    }

    let mounted = true;

    const bootstrap = async () => {
      const cached = await contactSuggestionsService.getCachedSuggestions(String(user.id));
      if (mounted && cached.length) {
        setSuggestions(cached);
      }

      await runSync({ silent: true, requestPermission: true });
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [user?.id, runSync]);

  useFocusEffect(
    useCallback(() => {
      void runSync({ silent: true, requestPermission: false });
    }, [runSync]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState.match(/inactive|background/) && nextState === "active") {
        void runSync({ silent: true, requestPermission: false });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [runSync]);

  const filteredSuggestions = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return suggestions;

    return suggestions.filter((item) => {
      const name = String(item.fullName || "").toLowerCase();
      const phone = String(item.phone || item.matchedPhone || "").toLowerCase();
      return name.includes(query) || phone.includes(query);
    });
  }, [searchText, suggestions]);

  const handleOpenProfile = useCallback(
    (userId: string) => {
      router.push({
        pathname: "/profile/[userId]",
        params: { userId: String(userId) },
      });
    },
    [router],
  );

  const handleGoToFriendRequest = useCallback(
    (targetUserId: string) => {
      if (!targetUserId) return;

      router.push({
        pathname: "/friends/requests",
        params: { userId: String(targetUserId) },
      });
    },
    [router],
  );

  return (
    <View className="flex-1 bg-[#F3F4F6]" style={{ paddingTop: insets.top }}>
      <CenterLoading visible={isSyncing} message="Đang đồng bộ danh bạ..." />

      <View className="h-14 px-4 flex-row items-center border-b border-gray-200 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">
          Gợi ý kết bạn từ danh bạ
        </Text>
      </View>

      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => void runSync({ force: true, silent: false, requestPermission: true })}
            className="h-10 px-4 rounded-xl bg-[#0A67DA] items-center justify-center"
            disabled={isSyncing}
          >
            <Text className="text-white text-sm font-semibold">
              {isSyncing ? "Đang đồng bộ..." : "Đồng bộ danh bạ"}
            </Text>
          </TouchableOpacity>

          <View className="ml-3 flex-1">
            <Text className="text-xs text-gray-500">
              Đã tìm thấy {suggestions.length} tài khoản
            </Text>
          </View>
        </View>

        <View className="mt-3 px-3 h-10 flex-row items-center rounded-xl bg-gray-100">
          <Ionicons name="search-outline" size={18} color="#6B7280" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm theo tên hoặc số điện thoại"
            className="ml-2 flex-1 text-[14px] text-gray-800"
          />
        </View>
      </View>

      {permissionDenied && (
        <View className="mx-4 mt-4 p-4 rounded-2xl bg-white border border-red-100">
          <Text className="text-sm text-gray-800">
            Ứng dụng chưa có quyền truy cập danh bạ.
          </Text>
          <TouchableOpacity
            className="mt-3 h-10 rounded-xl bg-gray-100 items-center justify-center"
            onPress={() => void Linking.openSettings()}
          >
            <Text className="text-sm text-gray-900 font-semibold">
              Mở cài đặt quyền
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredSuggestions}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <View className="bg-white rounded-2xl px-4 py-10 mt-3">
            <Text className="text-center text-gray-500 text-[15px]">
              Đồng bộ danh bạ để nhận gợi ý kết bạn
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl px-4 py-3 mb-3 border border-gray-100">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleOpenProfile(item.id)}
              className="flex-row items-center"
            >
              <Avatar
                uri={item.avatarUrl || undefined}
                name={item.fullName || "User"}
                size={52}
              />

              <View className="ml-3 flex-1">
                <Text className="text-[15px] text-gray-900 font-semibold">
                  {item.fullName || "Người dùng"}
                </Text>
                <Text className="text-[13px] text-gray-500 mt-1">
                  {item.matchedPhone || item.phone || "-"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleGoToFriendRequest(item.id)}
                className="h-9 px-3 rounded-lg items-center justify-center bg-[#0A67DA]"
              >
                <Text className="text-[13px] font-semibold text-white">
                  Kết bạn
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}
