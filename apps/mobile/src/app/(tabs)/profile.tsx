import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRef } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { userService } from "@/services";
import { Avatar } from "@/components/ui/Avatar";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, TextInput, Modal } from "react-native";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshToken, updateUser } = useAuthStore();
  const isLoggingOutRef = useRef(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const unreadNotificationCount = useNotificationStore((state) => state.unreadCount);

  const handleUpdatePin = async () => {
    if (!user?.id) return;

    if (isResetMode) {
      if (!loginPassword || newPin.length !== 6) {
        Alert.alert("Lỗi", "Vui lòng nhập mật khẩu App và mã PIN mới (6 số)");
        return;
      }
    } else {
      if (oldPin.length !== 6 || newPin.length !== 6) {
        Alert.alert("Lỗi", "Vui lòng nhập đủ 6 số cho cả mã cũ và mới");
        return;
      }
    }

    try {
      setIsChangingPin(true);
      if (isResetMode) {
        // Reset using login password
        const res = await userService.resetHiddenPin(user.id, loginPassword, newPin);
        if (res.success) {
          Alert.alert("Thành công", "Đã đặt lại mã PIN mới bằng mật khẩu đăng nhập");
          setShowPinChange(false);
          setIsResetMode(false);
          setLoginPassword("");
          setNewPin("");
        } else {
          Alert.alert("Lỗi", res.message || "Xác thực mật khẩu thất bại");
        }
      } else {
        // Normal change
        const verify = await userService.verifyHiddenPin(user.id, oldPin);
        if (!verify.success) {
          Alert.alert("Lỗi", "Mã PIN cũ không chính xác");
          return;
        }
        await userService.updateHiddenPin(user.id, newPin);
        Alert.alert("Thành công", "Đã đổi mã PIN mới");
        setShowPinChange(false);
        setOldPin("");
        setNewPin("");
      }
    } catch (e) {
      Alert.alert("Lỗi", "Không thể cập nhật mã PIN");
    } finally {
      setIsChangingPin(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          if (isLoggingOutRef.current) {
            return;
          }

          isLoggingOutRef.current = true;
          const tokenToRevoke = refreshToken;

          // Always clear local auth state immediately for responsive UX.
          logout();
          router.replace("/(auth)/login");

          try {
            if (tokenToRevoke) {
              await userService.logout(tokenToRevoke);
            }
          } catch {
            // Ignore revoke errors because user is already logged out locally.
          }
        },
      },
    ]);
  };

  const menuItems = [
    { icon: "🔔", title: "Thông báo", onPress: () => router.push("/profile/notifications") },
    { icon: "🌙", title: "Giao diện", onPress: () => router.push("/profile/appearance") },
    {
      icon: "🔒",
      title: "Bảo mật",
      onPress: () => router.push("/profile/security"),
    },
    {
      icon: "🔑",
      title: "Mã PIN ẩn",
      onPress: () => {
        if (!user?.hasHiddenPin) {
          Alert.alert("Thông báo", "Bạn chưa có cuộc trò chuyện ẩn nào. Hãy ẩn một cuộc trò chuyện để thiết lập mã PIN.");
        } else {
            setShowPinChange(true);
        }
      },
    },
    { icon: "💾", title: "Dữ liệu & Lưu trữ", onPress: () => router.push("/profile/data-storage") },
    { icon: "❓", title: "Trợ giúp", onPress: () => {} },
    { icon: "ℹ️", title: "Về ứng dụng", onPress: () => {} },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Profile card */}
      <TouchableOpacity
        className="bg-white p-4 flex-row items-center gap-4 mb-2"
        activeOpacity={0.7}
        onPress={() => router.push(`/profile/${user?.id}`)}
      >
        <Avatar name={user?.fullName || "?"} uri={user?.avatarUrl} size={60} />
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">
            {user?.fullName}
          </Text>
          <Text className="text-sm text-gray-500">{user?.email}</Text>
        </View>
        <Text className="text-gray-400 text-lg">›</Text>
      </TouchableOpacity>

      {/* Menu items */}
      <View className="bg-white mb-2">
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            onPress={item.onPress}
            className="flex-row items-center px-4 py-3.5 gap-4 border-b border-gray-50"
            activeOpacity={0.7}
          >
            <Text className="text-xl">{item.icon}</Text>
            <View className="flex-1 flex-row items-center justify-between">
              <Text className="text-gray-900">{item.title}</Text>
              {index === 0 && unreadNotificationCount > 0 ? (
                <View className="min-w-[22px] rounded-full bg-red-500 px-2 py-0.5 items-center">
                  <Text className="text-[11px] font-semibold text-white">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity
        onPress={handleLogout}
        className="bg-white mx-4 my-4 py-3.5 rounded-xl items-center"
        activeOpacity={0.7}
      >
        <Text className="text-red-500 font-semibold">Đăng xuất</Text>
      </TouchableOpacity>

      {/* Pin Change Modal */}
      <Modal visible={showPinChange} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, width: '100%', padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 8, textAlign: 'center' }}>
              {isResetMode ? 'Đặt lại mã PIN' : 'Đổi mã PIN ẩn'}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 24, textAlign: 'center' }}>
              {isResetMode ? 'Sử dụng mật khẩu đăng nhập để đặt lại mã PIN ẩn.' : 'Vui lòng nhập mã PIN hiện tại và mã PIN mới.'}
            </Text>
            
            {isResetMode ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>Mật khẩu đăng nhập</Text>
                <TextInput
                  style={{ backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: '#111827', marginBottom: 16 }}
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  secureTextEntry
                  placeholder="Nhập mật khẩu App"
                />
              </>
            ) : (
              <>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>Mã PIN cũ</Text>
                <TextInput
                  style={{ backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, fontSize: 18, color: '#111827', marginBottom: 16, textAlign: 'center' }}
                  value={oldPin}
                  onChangeText={(t) => setOldPin(t.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry
                  placeholder="••••••"
                />
              </>
            )}

            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>Mã PIN mới</Text>
            <TextInput
              style={{ backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, fontSize: 18, color: '#111827', marginBottom: 12, textAlign: 'center' }}
              value={newPin}
              onChangeText={(t) => setNewPin(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
              placeholder="••••••"
            />

            {!isResetMode && (
              <TouchableOpacity onPress={() => setIsResetMode(true)} style={{ marginBottom: 24 }}>
                <Text style={{ color: '#0068FF', fontSize: 13, textAlign: 'right' }}>Quên mã PIN?</Text>
              </TouchableOpacity>
            )}
            
            <View style={{ flexDirection: 'row', gap: 12, marginTop: isResetMode ? 12 : 0 }}>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#F3F4F6' }}
                onPress={() => { setShowPinChange(false); setOldPin(""); setNewPin(""); setIsResetMode(false); setLoginPassword(""); }}
              >
                <Text style={{ color: '#4B5563', fontWeight: '600' }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#0068FF' }}
                onPress={handleUpdatePin} 
                disabled={isChangingPin}
              >
                {isChangingPin ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: 'white', fontWeight: '600' }}>{isResetMode ? 'Đặt lại' : 'Cập nhật'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
