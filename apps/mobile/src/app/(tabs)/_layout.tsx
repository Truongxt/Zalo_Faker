import { useState } from "react";
import { Href, Tabs, useRouter } from "expo-router";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header } from "@/components/ui";
import { Colors } from "@/constants/colors";

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: Href;
};

const MENU_ITEMS: MenuItem[] = [
  {
    icon: "person-add-outline",
    label: "Them ban",
    route: "/friends/add",
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

  return <Ionicons name={icons[name]} size={24} color={focused ? Colors.primary : "#9CA3AF"} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <Header onAddPress={() => setMenuOpen((prev) => !prev)} />

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
            title: "Tin nhan",
            href: "/(tabs)/chat/chats",
            tabBarIcon: ({ focused }) => <TabIcon name="chat" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="contacts"
          options={{
            title: "Danh ba",
            tabBarIcon: ({ focused }) => <TabIcon name="contacts" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="moments"
          options={{
            title: "Khoanh khac",
            tabBarIcon: ({ focused }) => <TabIcon name="moments" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: "Kham pha",
            tabBarIcon: ({ focused }) => <TabIcon name="discover" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Ca nhan",
            tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
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
