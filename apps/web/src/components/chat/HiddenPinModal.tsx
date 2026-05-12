import { useState } from "react";
import { X, RefreshCw, KeyRound, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import authService from "@/services/auth";

interface HiddenPinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HiddenPinModal({ isOpen, onClose }: HiddenPinModalProps) {
  const { user, updateProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"change" | "reset">("change");

  // Setting PIN
  const [setupPin, setSetupPin] = useState("");
  
  // Changing PIN
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  
  // Resetting PIN
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !user) return null;

  const handleSetupPin = async () => {
    if (setupPin.length !== 6 || !/^\d{6}$/.test(setupPin)) {
      alert("Mã PIN phải có đúng 6 chữ số.");
      return;
    }
    
    setIsLoading(true);
    try {
      await authService.updateHiddenPin(user.id, setupPin);
      updateProfile({ hasHiddenPin: true });
      alert("Đã cài đặt mã PIN thành công!");
      onClose();
    } catch (error: any) {
      alert(error.message || "Không thể cài đặt mã PIN.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePin = async () => {
    if (oldPin.length !== 6 || newPin.length !== 6) {
      alert("Vui lòng nhập đầy đủ 6 số cho mã cũ và mã mới.");
      return;
    }

    setIsLoading(true);
    try {
      const verify = await authService.verifyHiddenPin(user.id, oldPin);
      if (!verify.success) {
        alert("Mã PIN cũ không chính xác.");
        return;
      }
      
      await authService.updateHiddenPin(user.id, newPin);
      alert("Đã đổi mã PIN thành công!");
      setOldPin("");
      setNewPin("");
      onClose();
    } catch (error: any) {
      alert(error.message || "Lỗi khi đổi mã PIN.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (!password || newPin.length !== 6) {
      alert("Vui lòng nhập mật khẩu và mã PIN mới gồm 6 số.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.resetHiddenPin(user.id, password, newPin);
      if (res.success) {
        alert("Đã đặt lại mã PIN thành công!");
        setPassword("");
        setNewPin("");
        onClose();
      } else {
        alert(res.message || "Xác thực mật khẩu thất bại.");
      }
    } catch (error: any) {
      alert(error.message || "Lỗi khi đặt lại mã PIN.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-dark-200 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-500" />
            Mã PIN trò chuyện ẩn
          </h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
          {!user.hasHiddenPin ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Bạn chưa cài đặt mã PIN. Vui lòng thiết lập mã PIN 6 số để bảo vệ các cuộc trò chuyện riêng tư của bạn.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mã PIN mới</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  maxLength={6}
                  value={setupPin}
                  onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Nhập 6 số"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-dark-300 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={handleSetupPin}
                disabled={isLoading || setupPin.length !== 6}
                className="w-full py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors font-medium mt-2"
              >
                {isLoading ? "Đang xử lý..." : "Cài đặt mã PIN"}
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex p-1 bg-gray-100 dark:bg-dark-300 rounded-lg">
                <button
                  onClick={() => setActiveTab("change")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors flex justify-center items-center gap-1 ${
                    activeTab === "change"
                      ? "bg-white dark:bg-dark-200 text-primary-600 dark:text-primary-400 shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <KeyRound className="w-4 h-4" /> Đổi mã PIN
                </button>
                <button
                  onClick={() => setActiveTab("reset")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors flex justify-center items-center gap-1 ${
                    activeTab === "reset"
                      ? "bg-white dark:bg-dark-200 text-primary-600 dark:text-primary-400 shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <RefreshCw className="w-4 h-4" /> Quên PIN
                </button>
              </div>

              {activeTab === "change" ? (
                <div className="flex flex-col gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mã PIN cũ</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      maxLength={6}
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Nhập mã PIN cũ (6 số)"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-dark-300 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mã PIN mới</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Nhập mã PIN mới (6 số)"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-dark-300 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <button
                    onClick={handleChangePin}
                    disabled={isLoading || oldPin.length !== 6 || newPin.length !== 6}
                    className="w-full py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors font-medium mt-2"
                  >
                    {isLoading ? "Đang xử lý..." : "Lưu thay đổi"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
                    Sử dụng mật khẩu đăng nhập để đặt lại mã PIN.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mật khẩu đăng nhập</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Nhập mật khẩu App"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-dark-300 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mã PIN mới</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Nhập mã PIN mới (6 số)"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-dark-300 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <button
                    onClick={handleResetPin}
                    disabled={isLoading || !password || newPin.length !== 6}
                    className="w-full py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors font-medium mt-2 flex items-center justify-center gap-1"
                  >
                    {isLoading ? "Đang xử lý..." : "Xác nhận đặt lại mã PIN"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
