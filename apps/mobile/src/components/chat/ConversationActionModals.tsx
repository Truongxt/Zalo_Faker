import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { conversationService } from "@/services/conversationService";
import { userService } from "@/services/userService";
import * as labelService from "@/services/labelService";
import type { Conversation } from "@/types";

// -----------------------------------------------------------------------
// LONG PRESS CONTEXT MENU
// -----------------------------------------------------------------------
interface ConversationMenuModalProps {
  visible: boolean;
  conversation: Conversation | null;
  onClose: () => void;
}

export function ConversationMenuModal({
  visible,
  conversation,
  onClose,
}: ConversationMenuModalProps) {
  const {
    conversations,
    updateConversation,
    labels,
    setLabels,
    addLabel,
    updateLabel,
    removeLabel,
  } = useChatStore();
  const { user } = useAuthStore();

  // Pick the LATEST data from store to avoid stale props issues
  const liveConversation =
    conversations.find((c) => c.id === conversation?.id) || conversation;

  const [activeTab, setActiveTab] = useState<"menu" | "labels" | "mute">(
    "menu",
  );
  const [pinLoading, setPinLoading] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);
  const [mutingOptionId, setMutingOptionId] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState("");
  const [isUpdatingLabel, setIsUpdatingLabel] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [setupPinCode, setSetupPinCode] = useState("");
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");

  const currentParticipant = liveConversation?.participants?.find(
    (p) => String(p.userId) === String(user?.id),
  );
  const isMuted = currentParticipant?.isMuted ?? false;
  const isPinned =
    (currentParticipant as any)?.isPinned ??
    liveConversation?.isPinned ??
    false;
  const selectedLabelIds: string[] = currentParticipant?.labelIds ?? [];

  useEffect(() => {
    if (visible) {
      setActiveTab("menu");
      setNewLabelName("");
      if (labels.length === 0) {
        labelService
          .getLabels()
          .then(setLabels)
          .catch(() => {});
      }
    }
  }, [visible]);

  if (!conversation) return null;

  const handlePin = async () => {
    if (!user?.id || !liveConversation) return;
    try {
      setPinLoading(true);
      await conversationService.togglePin(
        liveConversation.id,
        user.id,
        !isPinned,
      );
      // Update local store
      updateConversation(liveConversation.id, {
        isPinned: !isPinned,
        participants: liveConversation.participants?.map((p) =>
          String(p.userId) === String(user.id) ? ({ ...p, isPinned: !isPinned } as any) : p,
        ),
      });
      onClose();
    } catch (e: any) {
      console.error("[handlePin] error:", e?.response?.data || e?.message || e);
      Alert.alert("Lỗi", "Không thể thực hiện thao tác ghim");
    } finally {
      setPinLoading(false);
    }
  };

  const MUTE_OPTIONS = [
    {
      id: "1h",
      label: "Trong 1 giờ",
      desc: "Tự bật lại sau 60 phút.",
      getUntil: () => new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    {
      id: "4h",
      label: "Trong 4 giờ",
      desc: "Phù hợp khi cần tập trung trong nửa ngày.",
      getUntil: () => new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "8am",
      label: "Đến 8 giờ sáng",
      desc: "Tắt thông báo đến mốc 08:00 gần nhất.",
      getUntil: () => {
        const now = new Date();
        const next8am = new Date(now);
        next8am.setHours(8, 0, 0, 0);
        if (next8am <= now) next8am.setDate(next8am.getDate() + 1);
        return next8am.toISOString();
      },
    },
    {
      id: "forever",
      label: "Cho đến khi được mở lại",
      desc: "Giữ im lặng cho đến khi bạn tự bật lại.",
      getUntil: () => null,
    },
  ];

  const handleMuteOption = async (optionId: string) => {
    if (!user?.id || !liveConversation) return;
    const option = MUTE_OPTIONS.find((o) => o.id === optionId);
    if (!option) return;
    try {
      setMutingOptionId(optionId);
      const muteUntil = option.getUntil();
      await conversationService.updateParticipantSetting(
        liveConversation.id,
        user.id,
        {
          isMuted: true,
          muteUntil,
        },
      );
      updateConversation(liveConversation.id, {
        participants: liveConversation.participants?.map((p) =>
          String(p.userId) === String(user.id) ? { ...p, isMuted: true, muteUntil } : p,
        ),
      });
      onClose();
    } catch (e: any) {
      console.error(
        "[handleMuteOption] error:",
        e?.response?.data || e?.message || e,
      );
      Alert.alert("Lỗi", "Không thể tắt thông báo");
    } finally {
      setMutingOptionId(null);
    }
  };

  const handleUnmute = async () => {
    if (!user?.id || !liveConversation) return;
    try {
      setMuteLoading(true);
      await conversationService.updateParticipantSetting(
        liveConversation.id,
        user.id,
        {
          isMuted: false,
          muteUntil: null,
        },
      );
      updateConversation(liveConversation.id, {
        participants: liveConversation.participants?.map((p) =>
          String(p.userId) === String(user.id) ? { ...p, isMuted: false, muteUntil: null } : p,
        ),
      });
      onClose();
    } catch (e: any) {
      console.error(
        "[handleUnmute] error:",
        e?.response?.data || e?.message || e,
      );
      Alert.alert("Lỗi", "Không thể bật thông báo");
    } finally {
      setMuteLoading(false);
    }
  };

  const toggleLabel = async (labelId: string) => {
    if (!user?.id || !liveConversation) return;
    const newIds = selectedLabelIds.includes(labelId)
      ? selectedLabelIds.filter((id) => id !== labelId)
      : [...selectedLabelIds, labelId];

    console.log(
      "[toggleLabel] conversationId:",
      liveConversation.id,
      "userId:",
      user.id,
      "newIds:",
      newIds,
    );
    try {
      await conversationService.updateParticipantSetting(
        liveConversation.id,
        user.id,
        {
          labelIds: newIds,
        },
      );
      // Update local store
      updateConversation(liveConversation.id, {
        participants: liveConversation.participants?.map((p) =>
          String(p.userId) === String(user.id) ? { ...p, labelIds: newIds } : p,
        ),
      });
    } catch (e: any) {
      console.error(
        "[toggleLabel] error:",
        e?.response?.data || e?.message || e,
      );
      Alert.alert("Lỗi", "Không thể cập nhật nhãn. Vui lòng thử lại.");
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    console.log("[createLabel] name:", newLabelName.trim());
    try {
      setCreatingLabel(true);
      const label = await labelService.createLabel({
        name: newLabelName.trim(),
        color: "#0068FF",
      });
      console.log("[createLabel] success:", label);
      addLabel(label);
      setNewLabelName("");
    } catch (e: any) {
      console.error("[createLabel] error response:", e?.response?.data);
      console.error("[createLabel] error object:", e);
      Alert.alert("Lỗi", "Không thể tạo nhãn mới. Hãy thử lại.");
    } finally {
      setCreatingLabel(false);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    Alert.alert("Xác nhận", "Bạn có chắc chắn muốn xóa nhãn này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await labelService.deleteLabel(labelId);
            removeLabel(labelId);
          } catch (e: any) {
            console.error("[handleDeleteLabel] error:", e);
            Alert.alert("Lỗi", "Không thể xóa nhãn");
          }
        },
      },
    ]);
  };

  const handleStartEditLabel = (label: any) => {
    setEditingLabelId(label._id);
    setEditingLabelName(label.name);
  };

  const handleSaveLabelUpdate = async () => {
    if (!editingLabelId || !editingLabelName.trim()) return;
    try {
      setIsUpdatingLabel(true);
      await labelService.updateLabel(editingLabelId, {
        name: editingLabelName.trim(),
      });
      updateLabel(editingLabelId, { name: editingLabelName.trim() });
      setEditingLabelId(null);
    } catch (e: any) {
      console.error("[handleSaveLabelUpdate] error:", e);
      Alert.alert("Lỗi", "Không thể cập nhật nhãn");
    } finally {
      setIsUpdatingLabel(false);
    }
  };

  const isAlreadyHidden = currentParticipant?.isHidden === true;

  const handleToggleHideConversation = async () => {
    if (!user?.id || !liveConversation) return;

    if (!user.hasHiddenPin) {
      setShowPinSetup(true);
      return;
    }

    if (isAlreadyHidden) {
      // Unhide
      try {
        await conversationService.updateParticipantSetting(
          liveConversation.id,
          user.id,
          {
            isHidden: false,
          },
        );
        updateConversation(liveConversation.id, {
          participants: liveConversation.participants?.map((p) =>
            String(p.userId) === String(user.id) ? { ...p, isHidden: false } : p,
          ),
        });
        Alert.alert("Thành công", "Đã bỏ ẩn cuộc trò chuyện");
        onClose();
      } catch (e) {
        Alert.alert("Lỗi", "Không thể bỏ ẩn cuộc trò chuyện");
      }
    } else {
      // Hide
      Alert.alert(
        "Ẩn cuộc trò chuyện?",
        "Để mở lại cuộc trò chuyện này, bạn cần nhập mã PIN vào thanh tìm kiếm.",
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Ẩn",
            onPress: async () => {
              try {
                await conversationService.updateParticipantSetting(
                  liveConversation.id,
                  user.id,
                  {
                    isHidden: true,
                  },
                );
                updateConversation(liveConversation.id, {
                  participants: liveConversation.participants?.map((p) =>
                    String(p.userId) === String(user.id) ? { ...p, isHidden: true } : p,
                  ),
                });
                onClose();
              } catch (e) {
                Alert.alert("Lỗi", "Không thể ẩn cuộc trò chuyện");
              }
            },
          },
        ],
      );
    }
  };
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
        const res = await userService.resetHiddenPin(
          user.id,
          loginPassword,
          newPin,
        );
        if (res.success) {
          Alert.alert(
            "Thành công",
            "Đã đặt lại mã PIN mới bằng mật khẩu đăng nhập",
          );
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

  const handleSavePin = async () => {
    if (setupPinCode.length !== 6 || !user?.id) {
      Alert.alert("Lỗi", "Mã PIN phải có đủ 6 chữ số");
      return;
    }
    try {
      setIsSettingPin(true);
      await userService.updateHiddenPin(user.id, setupPinCode);
      useAuthStore.getState().updateUser({ hasHiddenPin: true });
      setShowPinSetup(false);
      Alert.alert(
        "Thành công",
        "Đã đặt mã PIN. Bây giờ bạn có thể ẩn cuộc trò chuyện.",
        [{ text: "OK", onPress: handleToggleHideConversation }],
      );
    } catch (e) {
      Alert.alert("Lỗi", "Không thể đặt mã PIN");
    } finally {
      setIsSettingPin(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        {activeTab === "menu" && (
          <>
            <Text style={styles.title}>Tùy chọn</Text>

            {/* Pin */}
            <TouchableOpacity
              style={styles.menuRow}
              onPress={handlePin}
              disabled={pinLoading}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isPinned ? "#EEF2FF" : "#F3F4F6" },
                ]}
              >
                {pinLoading ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <Ionicons
                    name={isPinned ? "pin" : "pin-outline"}
                    size={20}
                    color={isPinned ? "#6366F1" : "#374151"}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>
                  {isPinned
                    ? "Bỏ ghim cuộc trò chuyện"
                    : "Ghim cuộc trò chuyện"}
                </Text>
                <Text style={styles.menuDesc}>
                  {isPinned
                    ? "Xoá khỏi danh sách ghim"
                    : "Ghim lên đầu danh sách"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>

            {/* Mute */}
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => (isMuted ? handleUnmute() : setActiveTab("mute"))}
              disabled={muteLoading}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isMuted ? "#FEF2F2" : "#F3F4F6" },
                ]}
              >
                {muteLoading ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Ionicons
                    name={
                      isMuted ? "notifications-off" : "notifications-outline"
                    }
                    size={20}
                    color={isMuted ? "#EF4444" : "#374151"}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>
                  {isMuted ? "Bật thông báo" : "Tắt thông báo"}
                </Text>
                <Text style={styles.menuDesc}>
                  {isMuted
                    ? "Nhận lại thông báo từ cuộc trò chuyện"
                    : "Chọn thời gian tắt thông báo"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>

            {/* Labels */}
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => setActiveTab("labels")}
            >
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor:
                      selectedLabelIds.length > 0 ? "#EFF6FF" : "#F3F4F6",
                  },
                ]}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={20}
                  color={selectedLabelIds.length > 0 ? "#0068FF" : "#374151"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Phân loại nhãn</Text>
                <Text style={styles.menuDesc}>
                  {selectedLabelIds.length > 0
                    ? `Đang có ${selectedLabelIds.length} nhãn`
                    : "Gắn nhãn cho cuộc trò chuyện"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>

            {/* Hide */}
            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleToggleHideConversation}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isAlreadyHidden ? "#E0F2FE" : "#FEF2F2" },
                ]}
              >
                <Ionicons
                  name={isAlreadyHidden ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={isAlreadyHidden ? "#0068FF" : "#EF4444"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.menuLabel,
                    { color: isAlreadyHidden ? "#0068FF" : "#EF4444" },
                  ]}
                >
                  {isAlreadyHidden
                    ? "Bỏ ẩn cuộc trò chuyện"
                    : "Ẩn cuộc trò chuyện"}
                </Text>
                <Text style={styles.menuDesc}>
                  {isAlreadyHidden
                    ? "Hiện lại trong danh sách tin nhắn"
                    : "Giấu khỏi danh sách tin nhắn"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>

            {/* Change Hidden Pin (only show if has pin) */}
            {user?.hasHiddenPin && (
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => setShowPinChange(true)}
              >
                <View style={[styles.iconWrap, { backgroundColor: "#F3F4F6" }]}>
                  <Ionicons name="key-outline" size={20} color="#111827" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>Đổi mã PIN ẩn</Text>
                  <Text style={styles.menuDesc}>
                    Thay đổi mã bảo vệ trò chuyện ẩn
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Đóng</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === "mute" && (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <TouchableOpacity
                onPress={() => setActiveTab("menu")}
                style={{ marginRight: 12 }}
              >
                <Ionicons name="arrow-back" size={22} color="#111827" />
              </TouchableOpacity>
              <View>
                <Text style={[styles.title, { marginBottom: 0 }]}>
                  Tắt thông báo
                </Text>
                <Text
                  style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 16 }}
                >
                  Chọn thời gian bạn muốn tắt thông báo
                </Text>
              </View>
            </View>

            {MUTE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleMuteOption(option.id)}
                disabled={!!mutingOptionId}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#F3F4F6",
                  backgroundColor:
                    mutingOptionId === option.id ? "#EFF6FF" : "#FAFAFA",
                  marginBottom: 10,
                }}
              >
                {mutingOptionId === option.id ? (
                  <ActivityIndicator size="small" color="#0068FF" />
                ) : (
                  <>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: "#111827",
                      }}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={{ fontSize: 13, color: "#9CA3AF", marginTop: 3 }}
                    >
                      {option.desc}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Huỷ</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === "labels" && (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <TouchableOpacity
                onPress={() => setActiveTab("menu")}
                style={{ marginRight: 12 }}
              >
                <Ionicons name="arrow-back" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.title}>Phân loại nhãn</Text>
            </View>

            {/* Create new */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              <TextInput
                value={newLabelName}
                onChangeText={setNewLabelName}
                placeholder="Tên nhãn mới..."
                placeholderTextColor="#9CA3AF"
                style={{
                  flex: 1,
                  height: 40,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 14,
                  color: "#111827",
                }}
              />
              <TouchableOpacity
                onPress={handleCreateLabel}
                disabled={creatingLabel || !newLabelName.trim()}
                style={{
                  height: 40,
                  paddingHorizontal: 16,
                  backgroundColor: newLabelName.trim() ? "#0068FF" : "#E5E7EB",
                  borderRadius: 8,
                  justifyContent: "center",
                }}
              >
                {creatingLabel ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={{
                      color: newLabelName.trim() ? "#fff" : "#9CA3AF",
                      fontWeight: "600",
                    }}
                  >
                    Tạo
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {labels.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ color: "#9CA3AF", fontSize: 14 }}>
                  Chưa có nhãn nào. Hãy tạo nhãn đầu tiên!
                </Text>
              </View>
            ) : (
              <FlatList
                data={labels}
                keyExtractor={(item) => item._id}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => {
                  const isSelected = selectedLabelIds.includes(item._id);
                  const isEditing = editingLabelId === item._id;

                  return (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: "#F9FAFB",
                        minHeight: 52,
                      }}
                    >
                      {/* Selection Toggle and Info */}
                      <TouchableOpacity
                        onPress={() => toggleLabel(item._id)}
                        disabled={isEditing}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <Ionicons
                          name={
                            isSelected ? "checkmark-circle" : "ellipse-outline"
                          }
                          size={24}
                          color={isSelected ? "#0068FF" : "#D1D5DB"}
                          style={{ marginRight: 12 }}
                        />
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: item.color,
                            marginRight: 10,
                          }}
                        />
                        {isEditing ? (
                          <TextInput
                            value={editingLabelName}
                            onChangeText={setEditingLabelName}
                            autoFocus
                            style={{
                              flex: 1,
                              fontSize: 15,
                              color: "#111827",
                              paddingVertical: 4,
                              borderBottomWidth: 1,
                              borderBottomColor: "#0068FF",
                            }}
                          />
                        ) : (
                          <Text
                            style={{ flex: 1, fontSize: 16, color: "#111827" }}
                          >
                            {item.name}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {/* Actions */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {isEditing ? (
                          <>
                            <TouchableOpacity
                              onPress={handleSaveLabelUpdate}
                              disabled={isUpdatingLabel}
                            >
                              <Ionicons
                                name="checkmark"
                                size={22}
                                color="#10B981"
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setEditingLabelId(null)}
                            >
                              <Ionicons
                                name="close"
                                size={22}
                                color="#EF4444"
                              />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity
                              onPress={() => handleStartEditLabel(item)}
                              style={{ padding: 4 }}
                            >
                              <Ionicons
                                name="create-outline"
                                size={20}
                                color="#6B7280"
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteLabel(item._id)}
                              style={{ padding: 4 }}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={20}
                                color="#EF4444"
                              />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </>
        )}
      </View>

      {/* Pin Setup Modal */}
      <Modal
        visible={showPinSetup}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPinSetup(false);
          setSetupPinCode("");
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.pinModal}>
            <Text style={styles.pinTitle}>Cài đặt mã PIN</Text>
            <Text style={styles.pinDesc}>
              Nhập 6 số để ẩn cuộc trò chuyện này.
            </Text>
            <TextInput
              style={styles.pinInput}
              value={setupPinCode}
              onChangeText={(t) => setSetupPinCode(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              maxLength={6}
              placeholder="000000"
              autoFocus
            />
            <View style={styles.pinActions}>
              <TouchableOpacity
                onPress={() => {
                  setShowPinSetup(false);
                  setSetupPinCode("");
                }}
              >
                <Text style={styles.pinCancel}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSavePin} disabled={isSettingPin}>
                {isSettingPin ? (
                  <ActivityIndicator size="small" color="#0068FF" />
                ) : (
                  <Text style={styles.pinConfirm}>Cài đặt</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pin Change Modal */}
      <Modal
        visible={showPinChange}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPinChange(false);
          setOldPin("");
          setNewPin("");
          setIsResetMode(false);
          setLoginPassword("");
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.pinModal}>
            <Text style={styles.pinTitle}>
              {isResetMode ? "Đặt lại mã PIN" : "Đổi mã PIN"}
            </Text>

            <Text style={[styles.pinDesc, { marginBottom: 8 }]}>
              {isResetMode ? "Mật khẩu đăng nhập" : "Nhập mã PIN cũ"}
            </Text>
            <TextInput
              style={[
                styles.pinInput,
                { marginBottom: 16, fontSize: isResetMode ? 16 : 18 },
              ]}
              value={isResetMode ? loginPassword : oldPin}
              onChangeText={(t) =>
                isResetMode
                  ? setLoginPassword(t)
                  : setOldPin(t.replace(/[^0-9]/g, ""))
              }
              keyboardType={isResetMode ? "default" : "numeric"}
              maxLength={isResetMode ? 50 : 6}
              secureTextEntry
              placeholder={isResetMode ? "Nhập mật khẩu App" : "••••••"}
            />

            <Text style={[styles.pinDesc, { marginBottom: 8 }]}>
              Nhập mã PIN mới
            </Text>
            <TextInput
              style={[styles.pinInput, { marginBottom: 12, fontSize: 18 }]}
              value={newPin}
              onChangeText={(t) => setNewPin(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
              placeholder="••••••"
            />

            {!isResetMode && (
              <TouchableOpacity
                onPress={() => setIsResetMode(true)}
                style={{ alignSelf: "flex-end", marginBottom: 20 }}
              >
                <Text style={{ color: "#0068FF", fontSize: 13 }}>
                  Quên mã PIN?
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.pinActions}>
              <TouchableOpacity
                onPress={() => {
                  setShowPinChange(false);
                  setOldPin("");
                  setNewPin("");
                  setIsResetMode(false);
                  setLoginPassword("");
                }}
              >
                <Text style={styles.pinCancel}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdatePin}
                disabled={isChangingPin}
              >
                {isChangingPin ? (
                  <ActivityIndicator size="small" color="#0068FF" />
                ) : (
                  <Text style={styles.pinConfirm}>
                    {isResetMode ? "Đặt lại" : "Cập nhật"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// -----------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  menuDesc: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 1,
  },
  cancelBtn: {
    marginTop: 16,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "500",
  },
  pinModal: {
    backgroundColor: "white",
    borderRadius: 20,
    width: "85%",
    padding: 24,
    alignItems: "center",
    alignSelf: "center",
    marginTop: "40%",
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  pinDesc: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  pinInput: {
    backgroundColor: "#F3F4F6",
    width: "100%",
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    textAlign: "center",
    letterSpacing: 8,
    fontWeight: "bold",
    color: "#0068FF",
    marginBottom: 24,
  },
  pinActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 12,
  },
  pinCancel: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "600",
  },
  pinConfirm: {
    fontSize: 16,
    color: "#0068FF",
    fontWeight: "bold",
  },
});
