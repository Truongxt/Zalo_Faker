import { useState, FormEvent, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/auth";
import { useToast } from "@/contexts/ToastContext";
import { Eye, EyeOff, MessageCircle, Loader2, Check } from "lucide-react";

const GENDERS = [
  { label: "Nam", value: "male" },
  { label: "Nữ", value: "female" },
  { label: "Khác", value: "other" },
] as const;

type RegisterStep = "email" | "otp" | "info";
const RESEND_COOLDOWN_SECONDS = 60;

export default function Register() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { setUser, setAccessToken, setRefreshToken } = useAuthStore();

  const [step, setStep] = useState<RegisterStep>("email");
  const [otp, setOtp] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState<number | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] =
    useState<(typeof GENDERS)[number]["value"]>("male");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setLocalError] = useState("");
  const [agreed, setAgreed] = useState(false);

  const passwordRequirements = [
    { met: password.length >= 8, text: "Ít nhất 8 ký tự" },
    { met: /[A-Z]/.test(password), text: "Có chữ in hoa" },
    { met: /[0-9]/.test(password), text: "Có số" },
    {
      met: password === confirmPassword && password.length > 0,
      text: "Mật khẩu khớp",
    },
  ];

  const isPasswordValid = passwordRequirements.every((req) => req.met);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const requestOtp = async () => {
    setLocalError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setLocalError("Vui lòng nhập email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setLocalError("Email không hợp lệ");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.registerRequestOtp(normalizedEmail);
      setStep("otp");
      setOtp("");
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
      setOtpExpiresIn(result.expiresIn);
      addToast("Mã xác thực OTP đã được gửi đến email của bạn", "success");
    } catch (err: any) {
      setLocalError(err.message || "Không thể gửi OTP đăng ký");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      setLocalError("Vui lòng nhập mã OTP");
      return;
    }

    setIsLoading(true);
    setLocalError("");

    try {
      await authService.registerVerifyOtp(
        email.trim().toLowerCase(),
        otp.trim(),
      );
      setStep("info");
      addToast(
        "Email đã được xác thực. Hãy hoàn tất thông tin đăng ký.",
        "success",
      );
    } catch (err: any) {
      setLocalError(err.message || "Xác thực email thất bại.");
    } finally {
      setIsLoading(false);
    }
  };

  const completeRegistration = async () => {
    if (!fullName.trim() || !phone.trim() || !birthday.trim()) {
      setLocalError("Vui lòng nhập đầy đủ thông tin bắt buộc");
      return;
    }

    if (!isPasswordValid) {
      setLocalError("Mật khẩu không đáp ứng yêu cầu");
      return;
    }

    if (!agreed) {
      setLocalError("Vui lòng đồng ý với điều khoản sử dụng");
      return;
    }

    setIsLoading(true);
    setLocalError("");

    try {
      const { user, accessToken, refreshToken } = await authService.register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        birthday: birthday.trim(),
        gender,
        password,
      });
      setUser(user);
      setAccessToken(accessToken);
      setRefreshToken(refreshToken);
      addToast("Đăng ký tài khoản thành công!", "success");
      navigate("/chat");
    } catch (err: any) {
      setLocalError(err.message || "Đăng ký thất bại.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (step === "email") {
      await requestOtp();
    } else if (step === "otp") {
      await verifyOtp();
    } else {
      await completeRegistration();
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center p-12 overflow-y-auto">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">taklo</h1>
          </div>

          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Tham gia cộng đồng
            <br />
            hàng triệu người dùng
          </h2>

          <p className="text-lg text-white/80 mb-8">
            Đăng ký ngay để trải nghiệm nhắn tin, gọi video chất lượng cao và
            trợ lý AI thông minh.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <span>Miễn phí hoàn toàn</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <span>Bảo mật end-to-end</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <span>Hỗ trợ đa nền tảng</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Register form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-dark-100 overflow-y-auto min-h-screen relative">
        <div className="w-full max-w-md py-8">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-6">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                taklo
              </h1>
            </div>
          </div>

          <div className="card p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {step === "email"
                ? "Đăng ký tài khoản"
                : step === "otp"
                  ? "Xác thực Email"
                  : "Tạo tài khoản"}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {step === "email"
                ? "Nhập email để nhận mã xác thực trước khi điền thông tin"
                : step === "otp"
                  ? "Mã đã được gửi để đảm bảo tài khoản thuộc về bạn"
                  : "Điền đầy đủ thông tin để bắt đầu sử dụng"}
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {step === "email" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="example@email.com"
                    required
                    autoComplete="email"
                  />
                </div>
              ) : step === "info" ? (
                <>
                  <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm border border-blue-100 dark:border-blue-800">
                    Email đã xác thực: <strong>{email}</strong>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input"
                      placeholder="Nguyễn Văn A"
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input"
                      placeholder="0912345678"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ngày sinh
                    </label>
                    <input
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="input"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Định dạng: YYYY-MM-DD
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Giới tính
                    </label>
                    <div className="flex gap-2">
                      {GENDERS.map((item) => {
                        const active = gender === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => setGender(item.value)}
                            className={`flex-1 h-11 rounded-xl items-center justify-center border transition-colors ${
                              active
                                ? "border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"
                                : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-dark-200 dark:text-gray-300"
                            }`}
                          >
                            <span className="font-medium text-sm">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mật khẩu
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input pr-12"
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Xác nhận mật khẩu
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input pr-12"
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Password requirements */}
                  <div className="grid grid-cols-2 gap-2 mt-3 mb-4">
                    {passwordRequirements.map((req, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            req.met
                              ? "bg-green-500"
                              : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        >
                          {req.met && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span
                          className={`text-xs ${
                            req.met
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {req.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer mt-4">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="w-4 h-4 mt-1 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Tôi đồng ý với{" "}
                      <a href="#" className="text-primary-500 hover:underline">
                        Điều khoản sử dụng
                      </a>{" "}
                      và{" "}
                      <a href="#" className="text-primary-500 hover:underline">
                        Chính sách bảo mật
                      </a>
                    </span>
                  </label>
                </>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm mb-6 border border-blue-100 dark:border-blue-800">
                    Mã xác thực đã được gửi đến email <strong>{email}</strong>.
                    Vui lòng kiểm tra hộp thư (bao gồm cả thư rác).
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mã OTP
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="input tracking-[0.5em] text-center text-xl font-mono"
                      placeholder="••••••"
                      maxLength={6}
                      required
                    />
                    <div className="flex justify-between mt-3">
                      {otpExpiresIn ? (
                        <span className="text-xs text-primary-600 dark:text-primary-400">
                          Còn {Math.floor(otpExpiresIn / 60)}:
                          {(otpExpiresIn % 60).toString().padStart(2, "0")}
                        </span>
                      ) : (
                        <span />
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (resendCountdown === 0) requestOtp();
                        }}
                        disabled={isLoading || resendCountdown > 0}
                        className={`text-xs font-medium ${resendCountdown > 0 ? "text-gray-400" : "text-primary-500 hover:text-primary-600 cursor-pointer"}`}
                      >
                        {resendCountdown > 0
                          ? `Gửi lại sau ${resendCountdown}s`
                          : "Gửi lại mã OTP"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    (step === "info" && (!isPasswordValid || !agreed))
                  }
                  className="btn-primary w-full h-12 text-base"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : step === "email" ? (
                    "Gửi mã OTP"
                  ) : step === "otp" ? (
                    "Xác thực Email"
                  ) : (
                    "Đăng ký"
                  )}
                </button>

                {step === "otp" && (
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    disabled={isLoading}
                    className="w-full h-12 text-base mt-3 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Quay lại chỉnh sửa email
                  </button>
                )}
              </div>
            </form>
          </div>

          <p className="text-center mt-6 text-gray-600 dark:text-gray-400">
            Đã có tài khoản?{" "}
            <Link
              to="/login"
              className="text-primary-500 hover:text-primary-600 font-medium"
            >
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
