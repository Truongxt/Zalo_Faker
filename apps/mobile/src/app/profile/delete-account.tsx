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
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [confirmIrreversible, setConfirmIrreversible] = useState(false);

  useEffect(() => {
    if (otpCountdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [otpCountdown]);

  const goBackSafe = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/profile/security");
  };

  const handleRequestOtp = async () => {
    if (!user?.id) {
      Alert.alert("Lỗi", "Không tìm thấy ID người dùng");
      return;
    }

    if (otpCountdown > 0) {
      return;
    }

    setOtpLoading(true);
    try {
      await userService.requestPermanentLockOtp(user.id);
      setOtpCountdown(60);
      Alert.alert("Thành công", "OTP đã được gửi về email của bạn");
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || "Gửi OTP thất bại";
      Alert.alert("Lỗi", message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) {
      Alert.alert("Lỗi", "Không tìm thấy ID người dùng");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu hiện tại");
      return;
    }

    if (!otp.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập OTP");
      return;
    }

    if (!confirmIrreversible) {
      Alert.alert(
        "Xác nhận bắt buộc",
        "Bạn cần xác nhận rằng xóa tài khoản là vĩnh viễn và không thể khôi phục.",
      );
      return;
    }

    Alert.alert(
      "Xóa tài khoản vĩnh viễn",
      "Sau khi xác nhận, tài khoản sẽ bị xóa vĩnh viễn và không thể khôi phục. Tiếp tục?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa vĩnh viễn",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await userService.permanentLockAccount(
                user.id,
                password,
                otp,
                true,
              );
              logout();
              router.replace("/(auth)/login");
              Alert.alert("Thành công", "Tài khoản đã được xóa vĩnh viễn");
            } catch (error: any) {
              const message =
                error?.response?.data?.message ||
                error?.message ||
                "Xóa tài khoản thất bại";
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
          <Text className="text-lg font-bold text-gray-900">Xóa tài khoản</Text>
        </View>

        <View className="bg-white mx-4 my-4 rounded-xl p-4">
          <Text className="text-sm text-red-500 mb-4">
            Cảnh báo: Đây là thao tác vĩnh viễn. Dữ liệu tài khoản sẽ không thể
            khôi phục.
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              OTP xác nhận
            </Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3">
                <TextInput
                  placeholder="Nhập OTP"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  editable={!loading}
                  style={{ paddingVertical: 12, color: "#111827" }}
                  placeholderTextColor="#999"
                />
              </View>
              <TouchableOpacity
                onPress={handleRequestOtp}
                disabled={otpLoading || loading || otpCountdown > 0}
                className="bg-blue-500 px-3 py-3 rounded-lg"
                activeOpacity={0.7}
                style={{
                  opacity: otpLoading || loading || otpCountdown > 0 ? 0.7 : 1,
                }}
              >
                {otpLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-xs font-semibold">
                    {otpCountdown > 0
                      ? `Gửi lại (${otpCountdown}s)`
                      : "Gửi OTP"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Mật khẩu hiện tại
            </Text>
            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-3">
              <TextInput
                placeholder="Nhập mật khẩu hiện tại"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
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
            onPress={() => setConfirmIrreversible((prev) => !prev)}
            disabled={loading}
            className="flex-row items-start gap-3 mb-6"
            activeOpacity={0.7}
          >
            <View
              className={`w-5 h-5 rounded border mt-0.5 ${confirmIrreversible ? "bg-red-500 border-red-500" : "border-gray-400"}`}
            >
              {confirmIrreversible ? (
                <Text className="text-white text-center text-xs">✓</Text>
              ) : null}
            </View>
            <Text className="flex-1 text-sm text-gray-700">
              Tôi xác nhận xóa tài khoản là vĩnh viễn và không thể khôi phục.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={loading || otpLoading}
            className="bg-red-500 py-3 rounded-lg items-center"
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold">
                Xác thực và xóa vĩnh viễn
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
