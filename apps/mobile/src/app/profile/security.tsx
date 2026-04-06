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

export default function SecurityScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    // Validation
    if (!oldPassword.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu cũ");
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu mới");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu mới phải từ 6 ký tự trở lên");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu nhập lại không trùng khớp");
      return;
    }

    if (oldPassword === newPassword) {
      Alert.alert("Lỗi", "Mật khẩu mới phải khác mật khẩu cũ");
      return;
    }

    setLoading(true);
    try {
      if (!user?.id) {
        Alert.alert("Lỗi", "Không tìm thấy ID người dùng");
        return;
      }

      const result = await userService.changePassword(
        user.id,
        oldPassword,
        newPassword,
      );

      Alert.alert("Thành công", result.message, [
        {
          text: "OK",
          onPress: () => {
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            router.back();
          },
        },
      ]);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error.message ||
        "Đổi mật khẩu thất bại";
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView>
        {/* Header */}
        <View className="bg-white px-4 py-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-2xl">‹</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900">Bảo mật</Text>
        </View>

        {/* Change Password Form */}
        <View className="bg-white mx-4 my-4 rounded-xl p-4">
          <Text className="text-lg font-bold text-gray-900 mb-4">
            Đổi mật khẩu
          </Text>

          {/* Old Password */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Mật khẩu cũ
            </Text>
            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-3">
              <TextInput
                placeholder="Nhập mật khẩu cũ"
                secureTextEntry={!showOldPassword}
                value={oldPassword}
                onChangeText={setOldPassword}
                editable={!loading}
                style={{ flex: 1, paddingVertical: 12, color: "#111827" }}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowOldPassword(!showOldPassword)}
                disabled={loading}
              >
                <Text className="text-lg text-gray-500">
                  {showOldPassword ? "👁️" : "👁️‍🗨️"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Mật khẩu mới
            </Text>
            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-3">
              <TextInput
                placeholder="Nhập mật khẩu mới"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!loading}
                style={{ flex: 1, paddingVertical: 12, color: "#111827" }}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                disabled={loading}
              >
                <Text className="text-lg text-gray-500">
                  {showNewPassword ? "👁️" : "👁️‍🗨️"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Xác nhận mật khẩu
            </Text>
            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-3">
              <TextInput
                placeholder="Nhập lại mật khẩu mới"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
                style={{ flex: 1, paddingVertical: 12, color: "#111827" }}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
              >
                <Text className="text-lg text-gray-500">
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleChangePassword}
            disabled={loading}
            className="bg-blue-500 py-3 rounded-lg items-center"
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold">Đổi mật khẩu</Text>
            )}
          </TouchableOpacity>

          {/* Password Requirements */}
          <View className="mt-6 pt-4 border-t border-gray-200">
            <Text className="text-xs font-medium text-gray-600 mb-2">
              Yêu cầu mật khẩu:
            </Text>
            <Text className="text-xs text-gray-500">
              • Tối thiểu 6 ký tự{"\n"}• Khác với mật khẩu cũ{"\n"}• Phải xác
              nhận trùng khớp
            </Text>
          </View>
        </View>

        {/* Other Security Options */}
        <View className="bg-white mx-4 my-4 rounded-xl overflow-hidden">
          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 gap-4 border-b border-gray-50"
            activeOpacity={0.7}
          >
            <Text className="text-xl">🔐</Text>
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">
                Xác thực hai yếu tố
              </Text>
              <Text className="text-xs text-gray-500 mt-1">
                Bảo vệ tài khoản với thêm một lớp bảo mật
              </Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 gap-4"
            activeOpacity={0.7}
          >
            <Text className="text-xl">📱</Text>
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">
                Quản lý phiên đăng nhập
              </Text>
              <Text className="text-xs text-gray-500 mt-1">
                Xem và đăng xuất các thiết bị khác
              </Text>
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
