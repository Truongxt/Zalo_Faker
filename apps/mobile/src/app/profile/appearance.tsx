import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColorScheme } from "react-native";

export default function AppearanceScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const themes = [
    { id: "light", label: "Sáng", emoji: "☀️", desc: "Giao diện màu sáng mặc định" },
    { id: "dark", label: "Tối", emoji: "🌙", desc: "Giao diện màu tối, dễ nhìn ban đêm" },
    { id: "system", label: "Theo hệ thống", emoji: "📱", desc: `Hiện tại: ${colorScheme === "dark" ? "Tối" : "Sáng"}` },
  ];

  const currentTheme = "system"; // TODO: connect to theme store

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView>
        {/* Header */}
        <View className="bg-white px-4 py-4 flex-row items-center gap-3 border-b border-gray-100">
          <TouchableOpacity onPress={goBack}>
            <Text className="text-2xl text-[#0068FF]">‹</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900">Giao diện</Text>
        </View>

        {/* Theme options */}
        <View className="bg-white mx-4 my-4 rounded-xl overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-4 pt-4 pb-2">
            Chủ đề màu
          </Text>
          {themes.map((theme, index) => {
            const isActive = currentTheme === theme.id;
            return (
              <TouchableOpacity
                key={theme.id}
                activeOpacity={0.7}
                className={`flex-row items-center px-4 py-3.5 gap-3 ${index < themes.length - 1 ? "border-b border-gray-50" : ""}`}
              >
                <Text className="text-xl">{theme.emoji}</Text>
                <View className="flex-1">
                  <Text className="text-gray-900 font-medium">{theme.label}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">{theme.desc}</Text>
                </View>
                <View
                  className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                    isActive ? "border-[#0068FF]" : "border-gray-300"
                  }`}
                >
                  {isActive && (
                    <View className="w-2.5 h-2.5 rounded-full bg-[#0068FF]" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Font size */}
        <View className="bg-white mx-4 mb-4 rounded-xl overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-4 pt-4 pb-2">
            Kích cỡ chữ
          </Text>
          {["Nhỏ", "Vừa", "Lớn"].map((size, index) => (
            <TouchableOpacity
              key={size}
              activeOpacity={0.7}
              className={`flex-row items-center px-4 py-3.5 gap-3 ${index < 2 ? "border-b border-gray-50" : ""}`}
            >
              <Text className="text-gray-900 flex-1">{size}</Text>
              {size === "Vừa" && (
                <View className="w-5 h-5 rounded-full border-2 border-[#0068FF] items-center justify-center">
                  <View className="w-2.5 h-2.5 rounded-full bg-[#0068FF]" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
