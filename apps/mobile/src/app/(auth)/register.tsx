import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userService } from "@/services";

const DEFAULT_AVATAR_URL =
  "https://ui-avatars.com/api/?name=Zalo+Faker&background=0068FF&color=fff&size=256";

const GENDERS = [
  { label: "Nam", value: "male" },
  { label: "Nữ", value: "female" },
  { label: "Khác", value: "other" },
] as const;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const responseError = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };

    return (
      responseError.response?.data?.message || responseError.message || fallback
    );
  }

  return fallback;
};

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState("");
  const verifiedEmail =
    typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] =
    useState<(typeof GENDERS)[number]["value"]>("male");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập họ và tên");
      return;
    }
    if (!verifiedEmail) {
      Alert.alert("Lỗi", "Email chưa được xác thực. Vui lòng xác thực lại.");
      router.replace("/(auth)/register-otp");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập số điện thoại");
      return;
    }
    if (!birthday.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập ngày sinh");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu xác nhận không khớp");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Lỗi", "Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    setIsLoading(true);
    try {
      const registerData = {
        userName: fullName.trim(),
        email: verifiedEmail,
        phone: phone.trim(),
        birthday: birthday.trim(),
        gender,
        password,
        avartarUrl: DEFAULT_AVATAR_URL,
        status: "active",
      };

      await userService.registerComplete(registerData);
      Alert.alert("Thành công", "Đăng ký tài khoản thành công");
      router.replace("/(auth)/login");
    } catch (error) {
      Alert.alert("Lỗi", getErrorMessage(error, "Đăng ký thất bại"));
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
          className="flex-1 px-6"
          style={{
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 20,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="self-start rounded-full bg-white px-4 py-2 border border-gray-200"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text className="text-[#0068FF] text-base font-medium">
              ← Quay lại
            </Text>
          </TouchableOpacity>

          <View className="items-center mt-8 mb-8">
            <View className="w-20 h-20 rounded-[28px] bg-[#0068FF] items-center justify-center mb-4 shadow-lg">
              <Text className="text-white text-3xl font-bold">UIA</Text>
            </View>
            <Text className="text-3xl font-bold text-gray-900 text-center">
              Tạo tài khoản
            </Text>
            <Text className="text-gray-500 mt-2 text-center leading-5">
              Điền đầy đủ thông tin để bắt đầu sử dụng ứng dụng
            </Text>
          </View>

          <View className="bg-white rounded-[28px] border border-gray-200 shadow-sm px-5 py-5">
            <View className="gap-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Họ và tên
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Nguyễn Văn A"
                  autoCapitalize="words"
                  className="h-12 px-4 bg-gray-100 rounded-2xl text-gray-900"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Email đã xác thực
                </Text>
                <View className="h-12 px-4 bg-blue-50 rounded-2xl border border-blue-100 items-start justify-center">
                  <Text className="text-gray-900">
                    {verifiedEmail || "Chưa có email"}
                  </Text>
                </View>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Số điện thoại
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="0912345678"
                  keyboardType="phone-pad"
                  className="h-12 px-4 bg-gray-100 rounded-2xl text-gray-900"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Ngày sinh
                </Text>
                <TextInput
                  value={birthday}
                  onChangeText={setBirthday}
                  placeholder="YYYY-MM-DD"
                  className="h-12 px-4 bg-gray-100 rounded-2xl text-gray-900"
                  placeholderTextColor="#9CA3AF"
                />
                <Text className="text-xs text-gray-500 mt-1">
                  Ví dụ: 2000-01-31
                </Text>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2">
                  Giới tính
                </Text>
                <View className="flex-row gap-2">
                  {GENDERS.map((item) => {
                    const active = gender === item.value;

                    return (
                      <TouchableOpacity
                        key={item.value}
                        onPress={() => setGender(item.value)}
                        className="flex-1 h-11 rounded-2xl items-center justify-center border"
                        style={{
                          borderColor: active ? "#0068FF" : "#E5E7EB",
                          backgroundColor: active ? "#EFF6FF" : "#F9FAFB",
                        }}
                      >
                        <Text
                          className="font-semibold"
                          style={{ color: active ? "#0068FF" : "#374151" }}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Mật khẩu
                </Text>
                <View className="flex-row items-center bg-gray-100 rounded-2xl">
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Ít nhất 8 ký tự"
                    secureTextEntry={!showPassword}
                    className="flex-1 h-12 px-4 text-gray-900"
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

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Xác nhận mật khẩu
                </Text>
                <View className="flex-row items-center bg-gray-100 rounded-2xl">
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Nhập lại mật khẩu"
                    secureTextEntry={!showConfirmPassword}
                    className="flex-1 h-12 px-4 text-gray-900"
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="px-4 h-12 justify-center"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text className="text-[#0068FF] text-sm font-medium">
                      {showConfirmPassword ? "Ẩn" : "Hiện"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleRegister}
                disabled={isLoading}
                className="h-12 bg-[#0068FF] rounded-2xl items-center justify-center mt-2"
                activeOpacity={0.85}
                style={{ opacity: isLoading ? 0.7 : 1 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">
                    Đăng ký
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View className="mt-4 rounded-[24px] bg-[#F5F8FF] border border-blue-100 px-4 py-4">
              <Text className="text-sm font-semibold text-gray-900 mb-2">
                Ghi nhớ
              </Text>
              <Text className="text-sm text-gray-600 leading-5">
                Tài khoản sẽ được khởi tạo với ảnh đại diện mặc định. Bạn có thể
                cập nhật hồ sơ sau khi đăng nhập.
              </Text>
            </View>
          </View>

          {/* Login link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-gray-500">Đã có tài khoản? </Text>
            <Link href="/(auth)/login">
              <Text className="text-[#0068FF] font-semibold">Đăng nhập</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
