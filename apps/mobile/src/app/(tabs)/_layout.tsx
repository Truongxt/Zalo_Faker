import { useEffect, useRef, useState } from "react";
import { Href, Tabs, useRouter, useSegments } from "expo-router";
import {
  Alert,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header } from "@/components/ui";
import { Colors } from "@/constants/colors";
import { socketService } from "@/lib/socket";
import { groupCallInviteStore } from "@/lib/groupCallInviteStore";
import { useAuthStore } from "@/stores/authStore";

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: Href;
};

const MENU_ITEMS: MenuItem[] = [
  {
    icon: "person-add-outline",
    label: "Thêm bạn",
    route: "/friends/add",
  },
  {
    icon: "phone-portrait-outline",
    label: "Gợi ý từ danh bạ",
    route: "/friends/suggestions",
  },
  {
    icon: "people-outline",
    label: "Tạo nhóm",
    route: "/group/create",
  },
];

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    chat: focused ? "chatbubble" : "chatbubble-outline",
    contacts: focused ? "people" : "people-outline",
    moments: focused ? "sparkles" : "sparkles-outline",
    discover: focused ? "compass" : "compass-outline",
    profile: focused ? "person" : "person-outline",
  };

  return (
    <Ionicons
      name={icons[name]}
      size={24}
      color={focused ? Colors.primary : "#9CA3AF"}
    />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { user } = useAuthStore();
  const incomingHandledRef = useRef<string | null>(null);

  useEffect(() => {
    socketService.connect();
    const socket = socketService.getSocket();
    if (!socket || !user?.id) return;

    const handleIncomingCall = (data: any) => {
      const key = `${data?.fromUserId || ""}-${data?.conversationId || ""}-${data?.callType || ""}`;
      if (!key || incomingHandledRef.current === key) return;
      incomingHandledRef.current = key;

      const callerName = data?.callerName || "Nguoi dung";
      const callTypeLabel = data?.callType === "video" ? "video" : "thoai";
      const isGroupCall = data?.isGroupCall === true;
      const conversationId = String(data?.conversationId || "");
      const roomId = String(data?.roomId || "");

      if (isGroupCall && conversationId && roomId) {
        groupCallInviteStore.set({
          conversationId,
          roomId,
          callType: data?.callType === "video" ? "video" : "audio",
          hostUserId: String(data?.hostUserId || data?.fromUserId || ""),
          callerName: String(callerName || ""),
          callerAvatar: data?.callerAvatar || null,
          updatedAt: Date.now(),
        });
      }

      Alert.alert(
        "Cuoc goi den",
        `${callerName} dang goi ${callTypeLabel} cho ban${isGroupCall ? " trong nhom" : ""}`,
        [
          {
            text: "Tu choi",
            style: "cancel",
            onPress: () => {
              if (!isGroupCall) {
                socketService.emit("video:reject-call", {
                  toUserId: data?.fromUserId,
                  conversationId: data?.conversationId,
                  isGroupCall: false,
                });
              }
              incomingHandledRef.current = null;
            },
          },
          {
            text: "Nhan",
            onPress: () => {
              const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              router.push({
                pathname: "/call/[callId]",
                params: {
                  callId,
                  callType: data?.callType || "audio",
                  conversationId,
                  fromUserId: String(data?.fromUserId || data?.hostUserId || ""),
                  toUserId: String(user.id),
                  toUserName: user.fullName || "",
                  toUserAvatar: user.avatarUrl || "",
                  callerName: callerName,
                  callerAvatar: data?.callerAvatar || "",
                  isCaller: "false",
                  autoAccept: isGroupCall ? "false" : "true",
                  isGroupCall: isGroupCall ? "true" : "false",
                  roomId,
                },
              });
              incomingHandledRef.current = null;
            },
          },
        ],
      );
    };

    // Handle new-style group call invite (from web clients using group:create + group:invite)
    const handleGroupIncoming = (data: any) => {
      // Convert to the same format as video:incoming-call
      handleIncomingCall({
        ...data,
        fromUserId: data?.hostUserId,
        isGroupCall: true,
      });
    };

    socket.on("video:incoming-call", handleIncomingCall);
    socket.on("group:incoming", handleGroupIncoming);
    return () => {
      socket.off("video:incoming-call", handleIncomingCall);
      socket.off("group:incoming", handleGroupIncoming);
    };
  }, [router, user?.id, user?.fullName, user?.avatarUrl]);

  const segments = useSegments() as string[];
  const activeLeafSegment = segments[segments.length - 1] || "";
  const isInChatStack = segments.includes("chat");
  const isChatListScreen = activeLeafSegment === "chats";
  const isDetailScreen =
    segments.includes("[conversationId]") ||
    segments.includes("[callId]") ||
    segments.includes("conversation-info") ||
    segments.includes("group-management");

  return (
    <View style={{ flex: 1 }}>
      {!isDetailScreen && (
        <Header onAddPress={() => setMenuOpen((prev) => !prev)} />
      )}

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarHideOnKeyboard: true,
          tabBarStyle: isDetailScreen
            ? { display: "none" }
            : {
                borderTopWidth: 0.5,
                borderTopColor: "#E5E7EB",
                paddingTop: 4,
                paddingBottom: Math.max(insets.bottom, 4),
                height: 60 + Math.max(insets.bottom, 4),
              },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="chat"
          options={{
            title: "Tin nhắn",
            href: "/(tabs)/chat/chats",
            tabBarIcon: ({ focused }) => (
              <TabIcon name="chat" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="contacts"
          options={{
            title: "Danh bạ",
            tabBarIcon: ({ focused }) => (
              <TabIcon name="contacts" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="moments"
          options={{
            title: "Khoảnh khắc",
            tabBarIcon: ({ focused }) => (
              <TabIcon name="moments" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: "Khám phá",
            tabBarIcon: ({ focused }) => (
              <TabIcon name="discover" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Cá nhân",
            tabBarIcon: ({ focused }) => (
              <TabIcon name="profile" focused={focused} />
            ),
          }}
        />
      </Tabs>

      {menuOpen && (
        <>
          <Pressable
            onPress={() => setMenuOpen(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.3)",
            }}
          />

          <View
            style={{
              position: "absolute",
              top: 50,
              right: 12,
              backgroundColor: "white",
              borderRadius: 12,
              paddingVertical: 8,
              width: 180,
              elevation: 10,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            {MENU_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                }}
                onPress={() => {
                  router.push(item.route);
                  setMenuOpen(false);
                }}
              >
                <Ionicons name={item.icon} size={20} color="#333" />
                <Text style={{ marginLeft: 8, color: "#333", fontSize: 15 }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
