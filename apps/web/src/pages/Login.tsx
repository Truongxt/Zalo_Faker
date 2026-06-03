import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";
import { useAuthStore } from "@/stores/authStore";
import { authService, type QrLoginSession } from "@/services/auth";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Smartphone,
} from "lucide-react";

const formatRemainingSeconds = (expiresAt?: string) => {
  if (!expiresAt) return 0;
  const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
};

export default function Login() {
  const navigate = useNavigate();
  const { setError, setUser, setAccessToken, setRefreshToken } = useAuthStore();

  const [loginMode, setLoginMode] = useState<"password" | "qr">("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setLocalError] = useState("");
  const [isLockedError, setIsLockedError] = useState(false);

  const [qrSession, setQrSession] = useState<QrLoginSession | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrHint, setQrHint] = useState("");
  const [qrRemainingSeconds, setQrRemainingSeconds] = useState(0);

  const qrExpiresText = useMemo(() => {
    if (!qrSession) return "";
    if (qrRemainingSeconds <= 0) return "Mã QR đã hết hạn";
    return `Mã hết hạn sau ${qrRemainingSeconds} giây`;
  }, [qrRemainingSeconds, qrSession]);

  const applyLoginResult = (payload: {
    user: any;
    accessToken: string;
    refreshToken: string;
  }) => {
    setUser(payload.user);
    setAccessToken(payload.accessToken);
    setRefreshToken(payload.refreshToken);
    navigate("/chat");
  };

  const requestQrSession = async () => {
    setQrError("");
    setQrHint("");
    setIsQrLoading(true);
    try {
      const session = await authService.createQrLoginSession();
      setQrSession(session);
      setQrRemainingSeconds(formatRemainingSeconds(session.expiresAt));
      setQrHint("Mở app taklo trên điện thoại, vào Trình quét QR và quét mã này.");
    } catch (err: any) {
      setQrSession(null);
      setQrError(err?.message || "Không tạo được mã QR");
    } finally {
      setIsQrLoading(false);
    }
  };

  useEffect(() => {
    requestQrSession();
  }, []);

  useEffect(() => {
    if (!qrSession) return;

    let isActive = true;
    const pollStatus = async () => {
      try {
        const status = await authService.getQrLoginStatus(
          qrSession.sessionId,
          qrSession.pollToken
        );
        if (!isActive) return;

        if (status.status === "confirmed" && status.auth) {
          applyLoginResult(status.auth);
          return;
        }

        if (status.status === "expired" || status.status === "consumed") {
          setQrHint("Phiên QR đã hết hạn. Vui lòng tạo mã mới.");
          setQrSession(null);
          return;
        }

        setQrHint("Đang chờ xác nhận trên điện thoại...");
      } catch (err: any) {
        if (!isActive) return;
        setQrError(err?.message || "Không kiểm tra được trạng thái đăng nhập QR");
      }
    };

    pollStatus();
    const timerId = window.setInterval(pollStatus, 2000);

    return () => {
      isActive = false;
      window.clearInterval(timerId);
    };
  }, [qrSession]);

  useEffect(() => {
    if (!qrSession) return;
    const tick = () => {
      setQrRemainingSeconds(formatRemainingSeconds(qrSession.expiresAt));
    };
    tick();
    const timerId = window.setInterval(tick, 1000);
    return () => window.clearInterval(timerId);
  }, [qrSession]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setIsLockedError(false);
    setIsLoading(true);

    try {
      const data = await authService.login(identifier, password);
      applyLoginResult(data);
    } catch (err: any) {
      const message = err.message || "Đăng nhập thất bại. Vui lòng thử lại.";
      const locked = /locked|khoa|khóa/i.test(message);
      setIsLockedError(locked);
      const displayMessage = locked
        ? "Tài khoản đang bị khóa. Vui lòng mở khóa để tiếp tục."
        : message;
      setLocalError(displayMessage);
      setError(displayMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-100 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(460px,1.05fr)]">
      <div className="relative hidden min-h-screen overflow-hidden bg-primary-600 lg:flex lg:items-center lg:justify-center lg:px-12">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(255,255,255,0.18) 0 1px, transparent 1px), linear-gradient(45deg, rgba(255,255,255,0.12) 0 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative max-w-md text-white">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/15 shadow-lg ring-1 ring-white/25 backdrop-blur-sm">
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">taklo</h1>
          </div>

          <h2 className="mb-5 text-4xl font-bold leading-tight">
            Kết nối mỗi lúc,
            <br />
            mọi nơi
          </h2>

          <p className="mb-8 text-lg leading-8 text-white/85">
            Nhắn tin, gọi video và chia sẻ khoảnh khắc với bạn bè, gia đình
            trong một không gian gọn gàng và thân thuộc.
          </p>

          <div className="grid gap-3">
            {[
              "Đăng nhập bằng mật khẩu hoặc mã QR",
              "Đồng bộ trò chuyện theo thời gian thực",
              "Cuộc gọi video và tin nhắn đa phương tiện",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur-sm"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-100" />
                <span className="text-sm font-medium text-white/95">{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-lg bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-white/90">
                Tin nhắn mới
              </span>
              <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-xs font-semibold text-emerald-950">
                Online
              </span>
            </div>
            <div className="space-y-3">
              <div className="w-4/5 rounded-lg rounded-bl-sm bg-white px-4 py-3 text-sm font-medium text-gray-800">
                Hẹn gặp bạn ở phòng họp lúc 9:00 nhé.
              </div>
              <div className="ml-auto w-3/4 rounded-lg rounded-br-sm bg-cyan-100 px-4 py-3 text-sm font-medium text-primary-800">
                Mình đã nhận lịch. Gặp lại sau!
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="w-full max-w-[480px]">
          <div className="mb-6 text-center lg:hidden">
            <div className="mb-4 inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-500">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                taklo
              </h1>
            </div>
          </div>

          <div className="card rounded-lg border border-gray-100 p-6 shadow-xl dark:border-gray-800 sm:p-8">
            <div className="mb-6">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">
                Chào mừng trở lại
              </p>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Đăng nhập
              </h2>
            </div>

            <p className="mb-6 leading-7 text-gray-600 dark:text-gray-400">
              Chọn cách đăng nhập phù hợp để tiếp tục trò chuyện trên taklo.
            </p>

            <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1 dark:bg-dark-300">
              <button
                type="button"
                onClick={() => setLoginMode("password")}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-all ${
                  loginMode === "password"
                    ? "bg-white text-primary-600 shadow-sm dark:bg-dark-200 dark:text-primary-300"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                <KeyRound className="h-4 w-4" />
                Mật khẩu
              </button>
              <button
                type="button"
                onClick={() => setLoginMode("qr")}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-all ${
                  loginMode === "qr"
                    ? "bg-white text-primary-600 shadow-sm dark:bg-dark-200 dark:text-primary-300"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                <QrCode className="h-4 w-4" />
                Mã QR
              </button>
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                {isLockedError ? (
                  <Link
                    to="/unlock-account"
                    className="mt-2 inline-block text-sm font-medium text-amber-600 hover:text-amber-700"
                  >
                    Mở khóa tài khoản ngay
                  </Link>
                ) : null}
              </div>
            )}

            {loginMode === "password" ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email hoặc số điện thoại
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="input h-12"
                    placeholder="example@email.com hoặc 09xxxxxxxx"
                    required
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input h-12 pr-12"
                      placeholder="Nhập mật khẩu"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-dark-300 dark:hover:text-gray-300"
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Ghi nhớ đăng nhập
                    </span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-primary-500 hover:text-primary-600"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary h-12 w-full text-base font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Đăng nhập"
                  )}
                </button>

                <div className="flex justify-center">
                  <Link
                    to="/unlock-account"
                    className="text-sm font-medium text-amber-600 hover:text-amber-700"
                  >
                    Mở khóa tài khoản
                  </Link>
                </div>
              </form>
            ) : (
              <div>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Đăng nhập nhanh
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Quét mã bằng điện thoại đã đăng nhập.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={requestQrSession}
                    disabled={isQrLoading}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-70 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-dark-300"
                    aria-label="Tạo mã QR mới"
                  >
                    {isQrLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Tạo mã mới
                  </button>
                </div>

                <div className="flex justify-center">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    {qrSession ? (
                      <QRCode value={qrSession.qrCodeValue} size={192} />
                    ) : (
                      <div className="flex h-48 w-48 items-center justify-center rounded-md bg-gray-100 px-4 text-center text-sm text-gray-500">
                        {isQrLoading ? "Đang tạo mã QR..." : "Chưa có mã QR"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-dark-300 dark:text-gray-300">
                  <div className="flex items-start gap-3">
                    <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                    <span>
                      Mở app taklo trên điện thoại, vào Trình quét QR và quét mã.
                    </span>
                  </div>
                  {qrSession ? (
                    <p className="mt-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {qrExpiresText}
                    </p>
                  ) : null}
                  {qrHint ? (
                    <p className="mt-2 text-xs font-medium text-primary-600 dark:text-primary-300">
                      {qrHint}
                    </p>
                  ) : null}
                  {qrError ? (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      {qrError}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
            Chưa có tài khoản?{" "}
            <Link
              to="/register"
              className="font-medium text-primary-500 hover:text-primary-600"
            >
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
