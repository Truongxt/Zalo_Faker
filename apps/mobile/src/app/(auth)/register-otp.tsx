import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { userService } from "@/services";

export default function RegisterOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const initialEmail = typeof params.email === "string" ? params.email : "";

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpRequested, setOtpRequested] = useState(Boolean(initialEmail));
  const [timer, setTimer] = useState(initialEmail ? 300 : 0);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (!otpRequested) {
      return;
    }

    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleRequestOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert("Lỗi", "Vui lòng nhập email");
      return;
    }

    setSendingOtp(true);
    try {
      await userService.registerRequestOtp(normalizedEmail);
      setEmail(normalizedEmail);
      setOtpRequested(true);
      setCanResend(false);
      setTimer(300);
      Alert.alert("Thành công", "OTP đã được gửi đến email của bạn");
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || error.message || "Gửi OTP thất bại";
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mã OTP");
      return;
    }

    if (otp.length !== 6) {
      Alert.alert("Lỗi", "Mã OTP phải có 6 chữ số");
      return;
    }

    setLoading(true);
    try {
      await userService.registerVerifyOtp(email, otp);
      Alert.alert("Thành công", "Email đã được xác thực", [
        {
          text: "OK",
          onPress: () => {
            router.replace({
              pathname: "/(auth)/register",
              params: { email },
            });
          },
        },
      ]);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error.message ||
        "Xác thực OTP thất bại";
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResendLoading(true);
    try {
      await userService.registerRequestOtp(email);
      setOtp("");
      setTimer(300);
      setCanResend(false);
      Alert.alert("Thành công", "OTP mới đã được gửi đến email của bạn");
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || error.message || "Gửi OTP thất bại";
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoBack = () => {
    Alert.alert(
      "Xác nhận",
      "Bạn có chắc muốn quay lại? Bạn sẽ phải đăng ký lại.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Quay lại",
          style: "destructive",
          onPress: () => router.back(),
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        {/* Header */}
        <View className="px-4 py-6">
          <TouchableOpacity onPress={handleGoBack} className="mb-4">
            <Text className="text-2xl">‹</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            Xác thực Email
          </Text>
          {otpRequested ? (
            <Text className="text-gray-600">
              Nhập mã OTP được gửi đến {"\n"}
              <Text className="font-semibold text-gray-900">{email}</Text>
            </Text>
          ) : (
            <Text className="text-gray-600">
              Nhập email để nhận mã OTP xác thực trước khi đăng ký tài khoản
            </Text>
          )}
        </View>

        {/* OTP Input */}
        <View className="px-4 py-8 flex-1">
          <View className="bg-white rounded-xl p-6 mb-6">
            {!otpRequested ? (
              <>
                <Text className="text-sm font-medium text-gray-700 mb-3">
                  Email
                </Text>
                <TextInput
                  placeholder="example@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  editable={!sendingOtp}
                  style={{
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    borderRadius: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    color: "#111827",
                  }}
                />

                <TouchableOpacity
                  onPress={handleRequestOtp}
                  disabled={sendingOtp}
                  className="py-4 rounded-xl items-center mt-5 bg-blue-500"
                  activeOpacity={0.7}
                >
                  {sendingOtp ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-lg">
                      Gửi OTP
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text className="text-sm font-medium text-gray-700 mb-3">
                  Mã OTP (6 chữ số)
                </Text>
                <TextInput
                  placeholder="000000"
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                  maxLength={6}
                  editable={!loading}
                  style={{
                    borderWidth: 2,
                    borderColor: otp.length === 6 ? "#0068FF" : "#E5E7EB",
                    borderRadius: 12,
                    paddingVertical: 16,
                    paddingHorizontal: 12,
                    fontSize: 24,
                    fontWeight: "bold",
                    letterSpacing: 8,
                    textAlign: "center",
                    color: "#111827",
                  }}
                />

                {/* Timer and Resend */}
                <View className="mt-6 pt-6 border-t border-gray-200">
                  <Text className="text-center text-sm text-gray-600 mb-3">
                    {canResend
                      ? "Mã OTP hết hạn"
                      : `Mã sẽ hết hạn trong ${formatTime(timer)}`}
                  </Text>

                  <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={!canResend || resendLoading}
                    className={`py-3 rounded-lg items-center ${
                      canResend ? "bg-blue-500" : "bg-gray-200"
                    }`}
                  >
                    {resendLoading ? (
                      <ActivityIndicator color={canResend ? "white" : "#999"} />
                    ) : (
                      <Text
                        className={`font-semibold ${
                          canResend ? "text-white" : "text-gray-500"
                        }`}
                      >
                        Gửi lại OTP
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Verify Button */}
          {otpRequested ? (
            <TouchableOpacity
              onPress={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
              className={`py-4 rounded-xl items-center mb-4 ${
                otp.length === 6 && !loading ? "bg-blue-500" : "bg-gray-300"
              }`}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">Xác thực</Text>
              )}
            </TouchableOpacity>
          ) : null}

          {/* Info */}
          <View className="bg-blue-50 rounded-xl p-4 mt-4">
            <Text className="text-xs text-blue-900">
              💡 <Text className="font-semibold">Lưu ý:</Text> Nếu bạn không
              nhận được email, vui lòng kiểm tra thư mục Spam hoặc đợi vài giây
              rồi gửi lại.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
