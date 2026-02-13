import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/auth";
import { Colors } from "@/constants/colors";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser, setAccessToken } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập email và mật khẩu");
      return;
    }

    setIsLoading(true);
    try {
      const { user, accessToken } = await authService.login(email, password);
      setUser(user);
      setAccessToken(accessToken);
      router.replace("/(tabs)/chats");
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Đăng nhập thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo */}
        <View className="items-center mb-10">
          <View className="w-20 h-20 rounded-2xl bg-[#0068FF] items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">ZF</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">Zalo Faker</Text>
          <Text className="text-gray-500 mt-1">Đăng nhập để tiếp tục</Text>
        </View>

        {/* Form */}
        <View className="gap-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="h-12 px-4 bg-gray-100 rounded-xl text-gray-900"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              Mật khẩu
            </Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                className="h-12 px-4 pr-12 bg-gray-100 rounded-xl text-gray-900"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3"
              >
                <Text className="text-[#0068FF] text-sm font-medium">
                  {showPassword ? "Ẩn" : "Hiện"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity className="self-end">
            <Link href="/(auth)/forgot-password">
              <Text className="text-[#0068FF] text-sm font-medium">
                Quên mật khẩu?
              </Text>
            </Link>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            className="h-12 bg-[#0068FF] rounded-xl items-center justify-center mt-2"
            activeOpacity={0.8}
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
          <Text className="text-gray-500">Chưa có tài khoản? </Text>
          <Link href="/(auth)/register">
            <Text className="text-[#0068FF] font-semibold">Đăng ký</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
