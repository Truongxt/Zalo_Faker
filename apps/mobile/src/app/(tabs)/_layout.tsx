import { Href, Tabs } from "expo-router";
import { View, Text, TouchableOpacity, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { Header } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router";
type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: Href;
};
const MENU_ITEMS: MenuItem[] = [
  // {
  //   icon: "chatbubble-outline" as const,
  //   label: "Tin nhắn mới",
  //   route: "/new-chat",
  // },
  {
    icon: "person-add-outline" as const,
    label: "Thêm bạn",
    route: "/friends/add",
  },
  // {
  //   icon: "people-outline" as const,
  //   label: "Tạo nhóm",
  //   route: "/create-group",
  // },
];

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    chat: focused ? "chatbubble" : "chatbubble-outline",
    contacts: focused ? "people" : "people-outline",
    discover: focused ? "compass" : "compass-outline",
    profile: focused ? "person" : "person-outline",
  };
  return (
    <Ionicons
      name={icons[name] as any}
      size={24}
      color={focused ? Colors.primary : "#9CA3AF"}
    />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <Header onAddPress={() => setMenuOpen(!menuOpen)} />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarStyle: {
            borderTopWidth: 0.5,
            borderTopColor: "#E5E7EB",
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 4),
            height: 56 + Math.max(insets.bottom, 4),
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
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

      {/* Dropdown Menu */}
      {menuOpen && (
        <>
          {/* Backdrop overlay */}
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

          {/* Dropdown menu */}
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
            {MENU_ITEMS.map((item, index) => (
              <TouchableOpacity
                key={index}
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
