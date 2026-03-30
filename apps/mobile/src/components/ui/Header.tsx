import { Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type Href, useRouter } from "expo-router";

interface HeaderProps {
  onAddPress: () => void;
}

const Header = ({ onAddPress }: HeaderProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ backgroundColor: "#0068FF", paddingTop: insets.top }}>
      <View className="px-3 pb-2">
        <View className="flex-row items-center">
          <View className="flex-1 flex-row items-center bg-white rounded-full px-3 py-2">
            <Ionicons name="search" size={18} color="gray" />
            <Text className="ml-2 text-gray-500">Tìm kiếm</Text>
          </View>
          <View className="flex-row ml-3 gap-3 items-center">
            <TouchableOpacity
              onPress={() => router.push("/search/QRScanner" as Href)}
              activeOpacity={0.7}
            >
              <Ionicons name="qr-code-outline" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onAddPress} activeOpacity={0.7}>
              <Ionicons name="add" size={26} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

export default Header;
