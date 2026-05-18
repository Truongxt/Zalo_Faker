import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuthStore();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập email hoặc số điện thoại");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu");
      return;
    }

    setIsLoading(true);
    try {
      const { user, accessToken, refreshToken } = await userService.login(
        identifier.trim(),
        password,
      );
      login(user, accessToken, refreshToken);
      router.replace("/(tabs)/chat/chats");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Đăng nhập thất bại";
      if (/locked/i.test(message)) {
        Alert.alert(
          "Tài khoản bị khóa",
          "Bạn có muốn mở khóa tài khoản ngay không?",
          [
            { text: "Hủy", style: "cancel" },
            {
              text: "Mở khóa",
              onPress: () => router.push("/(auth)/unlock-account"),
            },
          ],
        );
      } else {
        Alert.alert("Đăng nhập thất bại", message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          className="flex-1 justify-center px-6"
          style={{
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          }}
        >
          {/* Logo */}
          <View className="items-center mb-12">
            <View className="w-20 h-20 rounded-2xl bg-[#0068FF] items-center justify-center mb-4 shadow-lg">
              <Text className="text-white text-3xl font-bold">ZF</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">taklo</Text>
            <Text className="text-gray-500 mt-1 text-sm">
              Đăng nhập để tiếp tục
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            {/* Email or phone */}
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">
                Email hoặc số điện thoại
              </Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="example@email.com hoặc 09xxxxxxxx"
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                className="h-12 px-4 bg-gray-100 rounded-xl text-gray-900 text-base"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Password */}
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">
                Mật khẩu
              </Text>
              <View className="flex-row items-center bg-gray-100 rounded-xl">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  className="flex-1 h-12 px-4 text-gray-900 text-base"
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="px-4 h-12 justify-center"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-[#0068FF] text-sm font-medium">
                    {showPassword ? "Ẩn" : "Hiện"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot password */}
            <View className="items-end">
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity>
                  <Text className="text-[#0068FF] text-sm font-medium">
                    Quên mật khẩu?
                  </Text>
                </TouchableOpacity>
              </Link>
              <Link href="/(auth)/unlock-account" asChild>
                <TouchableOpacity className="mt-2">
                  <Text className="text-amber-600 text-sm font-medium">
                    Mở khóa tài khoản
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>

            {/* Login button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              className="h-12 bg-[#0068FF] rounded-xl items-center justify-center mt-2"
              activeOpacity={0.85}
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Đăng nhập
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Register link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-gray-500 text-sm">Chưa có tài khoản? </Text>
            <Link href="/(auth)/register-otp" asChild>
              <TouchableOpacity>
                <Text className="text-[#0068FF] text-sm font-semibold">
                  Đăng ký ngay
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
