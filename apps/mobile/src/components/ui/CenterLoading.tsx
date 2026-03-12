import { ActivityIndicator, Text, View } from "react-native";

type CenterLoadingProps = {
  visible: boolean;
  message?: string;
};

export default function CenterLoading({
  visible,
  message = "Đang tải...",
}: CenterLoadingProps) {
  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/10">
      <View className="items-center rounded-2xl bg-black/55 px-6 py-5">
        <ActivityIndicator size="large" color="#FFFFFF" />
        {/* <Text className="mt-3 text-sm font-medium text-white">{message}</Text> */}
      </View>
    </View>
  );
}
