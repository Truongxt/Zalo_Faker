import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function DiscoverScreen() {
  const router = useRouter();

  const features = [
    { icon: "🤖", title: "AI Trợ lý", description: "Chat với AI thông minh" },
    { icon: "📰", title: "Bảng tin", description: "Xem cập nhật từ bạn bè" },
    { icon: "🎮", title: "Mini Game", description: "Giải trí cùng bạn bè" },
    { icon: "🛍️", title: "Mua sắm", description: "Khám phá sản phẩm" },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4 gap-3">
        {features.map((feature, index) => (
          <TouchableOpacity
            key={index}
            className="bg-white rounded-xl p-4 flex-row items-center gap-4"
            activeOpacity={0.7}
          >
            <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center">
              <Text className="text-2xl">{feature.icon}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900">
                {feature.title}
              </Text>
              <Text className="text-sm text-gray-500">
                {feature.description}
              </Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
