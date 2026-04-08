import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DataStorageScreen() {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const handleClearCache = () => {
    Alert.alert(
      "Xóa bộ nhớ đệm",
      "Ảnh và file tạm sẽ bị xóa. Dữ liệu tin nhắn không bị ảnh hưởng.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => {
            // TODO: clear expo file-system cache
            Alert.alert("Thành công", "Đã xóa bộ nhớ đệm");
          },
        },
      ],
    );
  };

  const handleClearMedia = () => {
    Alert.alert(
      "Xóa ảnh & video đã tải",
      "Các file media đã lưu trên thiết bị sẽ bị xóa.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => {
            Alert.alert("Thành công", "Đã xóa ảnh & video đã tải về");
          },
        },
      ],
    );
  };

  const storageItems = [
    { label: "Ảnh & Video", value: formatBytes(48 * 1024 * 1024), icon: "🖼️" },
    { label: "File tài liệu", value: formatBytes(12 * 1024 * 1024), icon: "📄" },
    { label: "Tin nhắn thoại", value: formatBytes(5 * 1024 * 1024), icon: "🎤" },
    { label: "Bộ nhớ đệm ứng dụng", value: formatBytes(3 * 1024 * 1024), icon: "⚡" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView>
        {/* Header */}
        <View className="bg-white px-4 py-4 flex-row items-center gap-3 border-b border-gray-100">
          <TouchableOpacity onPress={goBack}>
            <Text className="text-2xl text-[#0068FF]">‹</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900">Dữ liệu & Lưu trữ</Text>
        </View>

        {/* Storage breakdown */}
        <View className="bg-white mx-4 my-4 rounded-xl overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-4 pt-4 pb-2">
            Dung lượng sử dụng
          </Text>
          {storageItems.map((item, index) => (
            <View
              key={item.label}
              className={`flex-row items-center px-4 py-3.5 gap-3 ${index < storageItems.length - 1 ? "border-b border-gray-50" : ""}`}
            >
              <Text className="text-xl">{item.icon}</Text>
              <Text className="flex-1 text-gray-900">{item.label}</Text>
              <Text className="text-gray-500 text-sm">{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View className="bg-white mx-4 mb-4 rounded-xl overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-4 pt-4 pb-2">
            Quản lý dữ liệu
          </Text>
          <TouchableOpacity
            onPress={handleClearCache}
            activeOpacity={0.7}
            className="flex-row items-center px-4 py-4 gap-3 border-b border-gray-50"
          >
            <Text className="text-xl">🗑️</Text>
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">Xóa bộ nhớ đệm</Text>
              <Text className="text-xs text-gray-500 mt-0.5">Giải phóng {formatBytes(3 * 1024 * 1024)} dung lượng</Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClearMedia}
            activeOpacity={0.7}
            className="flex-row items-center px-4 py-4 gap-3"
          >
            <Text className="text-xl">📁</Text>
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">Xóa ảnh & video đã tải</Text>
              <Text className="text-xs text-gray-500 mt-0.5">Giải phóng {formatBytes(48 * 1024 * 1024)} dung lượng</Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
