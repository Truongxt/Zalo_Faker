import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { Colors } from "@/constants/colors";

// Tab bar icon component
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    chats: "💬",
    contacts: "👥",
    discover: "🔍",
    profile: "👤",
  };

  return (
    <View className="items-center justify-center">
      <Text style={{ fontSize: 22 }}>{icons[name] || "📱"}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: "#E5E7EB",
          paddingTop: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: "white",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: "Tin nhắn",
          headerTitle: "Zalo Faker",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="chats" focused={focused} />
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
          headerTitle: "Trang cá nhân",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
