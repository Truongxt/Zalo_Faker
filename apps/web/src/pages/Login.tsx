import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";
import { useAuthStore } from "@/stores/authStore";
import { authService, type QrLoginSession } from "@/services/auth";
import {
  Eye,
  EyeOff,
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
    if (qrRemainingSeconds <= 0) return "Ma QR da het han";
    return `Ma het han sau ${qrRemainingSeconds}s`;
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
      setQrHint("Mo app taklo tren dien thoai, vao QR Scanner va quet ma nay.");
    } catch (err: any) {
      setQrSession(null);
      setQrError(err?.message || "Khong tao duoc ma QR");
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
          setQrHint("Phien QR da het han. Vui long tao ma moi.");
          setQrSession(null);
          return;
        }

        setQrHint("Dang cho xac nhan tren dien thoai...");
      } catch (err: any) {
        if (!isActive) return;
        setQrError(err?.message || "Khong kiem tra duoc trang thai QR login");
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
      const message = err.message || "Dang nhap that bai. Vui long thu lai.";
      const locked = /locked|khoa/i.test(message);
      setIsLockedError(locked);
      const displayMessage = locked
        ? "Tai khoan dang bi khoa. Vui long mo khoa de tiep tuc."
        : message;
      setLocalError(displayMessage);
      setError(displayMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">taklo</h1>
          </div>

          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Ket noi moi luc,
            <br />
            moi noi
          </h2>

          <p className="text-lg text-white/80 mb-8">
            Nhan tin, goi video, chia se khoanh khac voi ban be va gia dinh.
            Hoan toan mien phi.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-dark-100">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
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
              Dang nhap
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Chao mung ban quay lai. Dang nhap mat khau hoac dung ma QR.
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                {isLockedError ? (
                  <Link
                    to="/unlock-account"
                    className="inline-block mt-2 text-amber-600 hover:text-amber-700 text-sm font-medium"
                  >
                    Mo khoa tai khoan ngay
                  </Link>
                ) : null}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email hoac so dien thoai
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="input"
                  placeholder="example@email.com hoac 09xxxxxxxx"
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mat khau
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-12"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
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

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Ghi nho dang nhap
                  </span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary-500 hover:text-primary-600 font-medium"
                >
                  Quen mat khau?
                </Link>
              </div>

              <div className="text-right -mt-2">
                <Link
                  to="/unlock-account"
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  Mo khoa tai khoan
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full h-12 text-base"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Dang nhap"
                )}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-dark-200 text-gray-500">
                  Hoac dang nhap bang QR
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                  <QrCode className="w-5 h-5 text-primary-500" />
                  <span className="font-semibold">Dang nhap nhanh</span>
                </div>
                <button
                  type="button"
                  onClick={requestQrSession}
                  disabled={isQrLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-70"
                >
                  {isQrLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Tao ma moi
                </button>
              </div>

              <div className="mt-4 flex justify-center">
                <div className="rounded-xl bg-white p-3 border border-gray-200">
                  {qrSession ? (
                    <QRCode value={qrSession.qrCodeValue} size={180} />
                  ) : (
                    <div className="w-[180px] h-[180px] flex items-center justify-center bg-gray-100 rounded-lg text-gray-500 text-sm text-center px-3">
                      {isQrLoading ? "Dang tao ma QR..." : "Chua co ma QR"}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary-500" />
                  <span>
                    Mo app taklo tren dien thoai, vao QR Scanner va quet ma.
                  </span>
                </div>
                {qrSession ? (
                  <p className="mt-2 text-xs text-gray-500">{qrExpiresText}</p>
                ) : null}
                {qrHint ? <p className="mt-2 text-xs text-primary-600">{qrHint}</p> : null}
                {qrError ? <p className="mt-2 text-xs text-red-600">{qrError}</p> : null}
              </div>
            </div>
          </div>

          <p className="text-center mt-8 text-gray-600 dark:text-gray-400">
            Chua co tai khoan?{" "}
            <Link
              to="/register"
              className="text-primary-500 hover:text-primary-600 font-medium"
            >
              Dang ky ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
