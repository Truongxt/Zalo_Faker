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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userService } from "@/services";

export default function UnlockAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const goBackSafe = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(auth)/login");
  };

  const handleUnlock = async () => {
    if (!email.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập email");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu");
      return;
    }

    setIsLoading(true);
    try {
      const result = await userService.unlockAccount(
        email.trim().toLowerCase(),
        password,
      );

      Alert.alert("Thành công", result.message, [
        {
          text: "Đăng nhập",
          onPress: () => router.replace("/(auth)/login"),
        },
      ]);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Mở khóa tài khoản thất bại";
      Alert.alert("Lỗi", message);
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
          <View className="mb-8">
            <TouchableOpacity onPress={goBackSafe}>
              <Text className="text-[#0068FF] text-base">‹ Quay lại</Text>
            </TouchableOpacity>
          </View>

          <View className="items-center mb-10">
            <View className="w-20 h-20 rounded-2xl bg-amber-500 items-center justify-center mb-4 shadow-lg">
              <Text className="text-white text-3xl font-bold">🔓</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">
              Mở khóa tài khoản
            </Text>
            <Text className="text-gray-500 mt-1 text-sm text-center">
              Nhập đúng email và mật khẩu để mở khóa
            </Text>
          </View>

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
                returnKeyType="next"
                className="h-12 px-4 bg-gray-100 rounded-xl text-gray-900 text-base"
                placeholderTextColor="#9CA3AF"
              />
            </View>

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
                  onSubmitEditing={handleUnlock}
                  className="flex-1 h-12 px-4 text-gray-900 text-base"
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="px-4 h-12 justify-center"
                >
                  <Text className="text-[#0068FF] text-sm font-medium">
                    {showPassword ? "Ẩn" : "Hiện"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleUnlock}
              disabled={isLoading}
              className="h-12 bg-amber-500 rounded-xl items-center justify-center mt-2"
              activeOpacity={0.85}
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Mở khóa tài khoản
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
