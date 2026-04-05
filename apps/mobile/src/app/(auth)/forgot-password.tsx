import { useEffect, useMemo, useState } from "react";
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userService } from "@/services";

const RESEND_COOLDOWN_SECONDS = 60;

type ForgotStep = "request" | "verify" | "reset" | "done";

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

const steps = [
  { id: "request", label: "Email", description: "Nhận OTP" },
  { id: "verify", label: "OTP", description: "Xác thực" },
  { id: "reset", label: "Mật khẩu", description: "Đặt lại" },
] as const;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<ForgotStep>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState<number | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  useEffect(() => {
    if (resendCountdown <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const requestOtp = async () => {
    if (!normalizedEmail) {
      Alert.alert("Lỗi", "Vui lòng nhập email");
      return;
    }

    setIsLoading(true);
    try {
      const result =
        await userService.requestForgotPasswordOtp(normalizedEmail);
      setOtp("");
      setStep("verify");
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
      setOtpExpiresIn(result.expiresIn);
      Alert.alert("Đã gửi OTP", "Kiểm tra hộp thư để lấy mã xác thực.");
    } catch (error) {
      Alert.alert(
        "Không thể gửi OTP",
        getErrorMessage(error, "Không thể gửi OTP"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!normalizedEmail) {
      Alert.alert("Lỗi", "Vui lòng nhập email");
      return;
    }
    if (!otp.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập OTP");
      return;
    }

    setIsLoading(true);
    try {
      await userService.verifyForgotPasswordOtp(normalizedEmail, otp.trim());
      setStep("reset");
      Alert.alert(
        "Xác thực thành công",
        "Bạn có thể đặt lại mật khẩu ngay bây giờ.",
      );
    } catch (error) {
      Alert.alert(
        "Xác thực thất bại",
        getErrorMessage(error, "Xác thực OTP thất bại"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!normalizedEmail) {
      Alert.alert("Lỗi", "Vui lòng nhập email");
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu mới");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Lỗi", "Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu xác nhận không khớp");
      return;
    }

    setIsLoading(true);
    try {
      await userService.resetForgotPassword(normalizedEmail, newPassword);
      setStep("done");
      Alert.alert("Thành công", "Mật khẩu đã được đặt lại.");
    } catch (error) {
      Alert.alert(
        "Đặt lại thất bại",
        getErrorMessage(error, "Không thể đặt lại mật khẩu"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrimaryAction = () => {
    if (step === "request") {
      void requestOtp();
      return;
    }

    if (step === "verify") {
      void verifyOtp();
      return;
    }

    if (step === "reset") {
      void resetPassword();
    }
  };

  const currentStepIndex =
    step === "request" ? 0 : step === "verify" ? 1 : step === "reset" ? 2 : 3;

  const title =
    step === "request"
      ? "Quên mật khẩu"
      : step === "verify"
        ? "Xác thực OTP"
        : step === "reset"
          ? "Đặt mật khẩu mới"
          : "Hoàn tất";

  const subtitle =
    step === "request"
      ? "Nhập email để nhận mã OTP"
      : step === "verify"
        ? "Nhập mã đã gửi vào email của bạn"
        : step === "reset"
          ? "Tạo mật khẩu mới cho tài khoản"
          : "Bạn đã có thể đăng nhập lại";

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
          className="flex-1"
          style={{
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 20,
          }}
        >
          <View className="px-6 pt-3 pb-6">
            <TouchableOpacity
              onPress={() => router.back()}
              className="self-start rounded-full bg-white px-4 py-2 border border-gray-200"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text className="text-[#0068FF] text-base font-medium">
                ← Quay lại
              </Text>
            </TouchableOpacity>

            <View className="items-center mt-8">
              <View className="w-20 h-20 rounded-[28px] bg-[#0068FF] items-center justify-center mb-4 shadow-lg">
                <Text className="text-white text-3xl font-bold">UIA</Text>
              </View>
              <Text className="text-3xl font-bold text-gray-900 text-center">
                {title}
              </Text>
              <Text className="text-gray-500 mt-2 text-center leading-5">
                {subtitle}
              </Text>
            </View>
          </View>

          <View className="px-6 mb-5">
            <View className="bg-gray-100 rounded-[28px] p-3 flex-row items-center justify-between">
              {steps.map((item, index) => {
                const isActive = index === currentStepIndex;
                const isDone = index < currentStepIndex;

                return (
                  <View key={item.id} className="flex-1 items-center">
                    <View
                      className="w-full items-center"
                      style={{ opacity: isDone ? 1 : isActive ? 1 : 0.5 }}
                    >
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{
                          backgroundColor:
                            isDone || isActive ? "#0068FF" : "#E5E7EB",
                        }}
                      >
                        <Text className="text-white font-bold">
                          {index + 1}
                        </Text>
                      </View>
                      <Text className="text-xs font-semibold mt-2 text-gray-900">
                        {item.label}
                      </Text>
                      <Text className="text-[11px] text-gray-500 mt-0.5">
                        {item.description}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="px-6 flex-1">
            <View className="bg-white rounded-[28px] border border-gray-200 shadow-sm px-5 py-5">
              <View className="mb-5">
                <Text className="text-lg font-bold text-gray-900">
                  {step === "request"
                    ? "Bước 1 · Nhập email"
                    : step === "verify"
                      ? "Bước 2 · Nhập OTP"
                      : step === "reset"
                        ? "Bước 3 · Tạo mật khẩu mới"
                        : "Hoàn tất"}
                </Text>
                <Text className="text-gray-500 mt-1 leading-5">
                  {step === "request"
                    ? "Hệ thống sẽ gửi một mã OTP qua email của bạn."
                    : step === "verify"
                      ? "Mã OTP chỉ dùng một lần và có hiệu lực trong thời gian ngắn."
                      : step === "reset"
                        ? "Chọn mật khẩu mới đủ mạnh để bảo vệ tài khoản."
                        : "Mật khẩu của bạn đã được cập nhật."}
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
                    editable={step !== "done"}
                    className="h-12 px-4 bg-gray-100 rounded-2xl text-gray-900 text-base"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {step !== "request" ? (
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1.5">
                      Mã OTP
                    </Text>
                    <TextInput
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="Nhập 6 số OTP"
                      keyboardType="number-pad"
                      editable={step === "verify"}
                      maxLength={6}
                      className="h-12 px-4 bg-gray-100 rounded-2xl text-gray-900 text-base tracking-[6px]"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                ) : null}

                {step === "reset" ? (
                  <>
                    <View>
                      <Text className="text-sm font-medium text-gray-700 mb-1.5">
                        Mật khẩu mới
                      </Text>
                      <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Ít nhất 8 ký tự"
                        secureTextEntry
                        className="h-12 px-4 bg-gray-100 rounded-2xl text-gray-900 text-base"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>

                    <View>
                      <Text className="text-sm font-medium text-gray-700 mb-1.5">
                        Xác nhận mật khẩu
                      </Text>
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Nhập lại mật khẩu"
                        secureTextEntry
                        returnKeyType="done"
                        onSubmitEditing={resetPassword}
                        className="h-12 px-4 bg-gray-100 rounded-2xl text-gray-900 text-base"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </>
                ) : null}

                <TouchableOpacity
                  onPress={handlePrimaryAction}
                  disabled={isLoading || step === "done"}
                  className="h-12 bg-[#0068FF] rounded-2xl items-center justify-center mt-2"
                  activeOpacity={0.88}
                  style={{ opacity: isLoading || step === "done" ? 0.7 : 1 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-semibold text-base">
                      {step === "request"
                        ? "Gửi OTP"
                        : step === "verify"
                          ? "Xác thực OTP"
                          : step === "reset"
                            ? "Đặt lại mật khẩu"
                            : "Đã hoàn tất"}
                    </Text>
                  )}
                </TouchableOpacity>

                {step === "verify" ? (
                  <TouchableOpacity
                    onPress={() => {
                      if (resendCountdown > 0) {
                        return;
                      }
                      void requestOtp();
                    }}
                    disabled={isLoading || resendCountdown > 0}
                    className="h-12 rounded-2xl items-center justify-center border border-[#0068FF] bg-white"
                    activeOpacity={0.85}
                    style={{
                      opacity: isLoading || resendCountdown > 0 ? 0.6 : 1,
                    }}
                  >
                    <Text className="text-[#0068FF] font-semibold text-base">
                      {resendCountdown > 0
                        ? `Gửi lại sau ${resendCountdown}s`
                        : "Gửi lại OTP"}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {step === "verify" && otpExpiresIn ? (
                  <View className="bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100">
                    <Text className="text-xs text-blue-700 text-center leading-5">
                      OTP có hiệu lực trong {Math.floor(otpExpiresIn / 60)} phút{" "}
                      {otpExpiresIn % 60} giây.
                    </Text>
                  </View>
                ) : null}

                {step === "done" ? (
                  <TouchableOpacity
                    onPress={() => router.replace("/(auth)/login")}
                    className="h-12 rounded-2xl items-center justify-center border border-[#0068FF] bg-white mt-2"
                    activeOpacity={0.85}
                  >
                    <Text className="text-[#0068FF] font-semibold text-base">
                      Về đăng nhập
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {step !== "done" ? (
              <View className="mt-4 rounded-[24px] bg-[#F5F8FF] border border-blue-100 px-4 py-4">
                <Text className="text-sm font-semibold text-gray-900 mb-2">
                  Lưu ý
                </Text>
                <Text className="text-sm text-gray-600 leading-5">
                  Mỗi OTP chỉ dùng một lần. Nếu chưa thấy email, hãy kiểm tra
                  mục spam hoặc chờ hết thời gian gửi lại.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
