import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services";

export default function LockAccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const goBackSafe = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/profile/security");
  };

  const handleLockAccount = async () => {
    if (!user?.id) {
      Alert.alert("Lỗi", "Không tìm thấy ID người dùng");
      return;
    }

    if (!currentPassword.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu hiện tại");
      return;
    }

    Alert.alert(
      "Khóa tài khoản",
      "Tài khoản sẽ bị khóa tạm thời và bạn có thể mở khóa sau. Tiếp tục?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Khóa",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await userService.lockAccount(user.id, currentPassword);
              logout();
              router.replace("/(auth)/login");
              Alert.alert("Thành công", "Tài khoản đã được khóa");
            } catch (error: any) {
              const message =
                error?.response?.data?.message ||
                error?.message ||
                "Khóa tài khoản thất bại";
              Alert.alert("Lỗi", message);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView>
        <View className="bg-white px-4 py-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={goBackSafe}>
            <Text className="text-2xl">‹</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900">
            Khóa tài khoản
          </Text>
        </View>

        <View className="bg-white mx-4 my-4 rounded-xl p-4">
          <Text className="text-sm text-gray-600 mb-4">
            Nhập mật khẩu hiện tại để xác thực trước khi khóa tài khoản.
          </Text>

          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Mật khẩu hiện tại
            </Text>
            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-3">
              <TextInput
                placeholder="Nhập mật khẩu hiện tại"
                secureTextEntry={!showPassword}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                editable={!loading}
                style={{ flex: 1, paddingVertical: 12, color: "#111827" }}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <Text className="text-lg text-gray-500">
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleLockAccount}
            disabled={loading}
            className="bg-amber-500 py-3 rounded-lg items-center"
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold">
                Xác thực và khóa tài khoản
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
