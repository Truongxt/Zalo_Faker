import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Colors } from "@/constants/colors";
import FriendsScreen from "./friends";
import GroupsScreen from "./groups";

const Tab = createMaterialTopTabNavigator();

export default function ContactsLayout() {
  return (
    <Tab.Navigator
      id="contacts-tabs"
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarIndicatorStyle: { backgroundColor: Colors.primary },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: "600",
          textTransform: "none",
        },
        tabBarStyle: {
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
        },
      }}
    >
      <Tab.Screen
        name="friends"
        component={FriendsScreen}
        options={{ title: "Bạn bè" }}
      />
      <Tab.Screen
        name="groups"
        component={GroupsScreen}
        options={{ title: "Nhóm" }}
      />
    </Tab.Navigator>
  );
}
