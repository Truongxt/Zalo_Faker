import { useState, useEffect } from "react";
import {
  Text,
  View,
  Button,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  CameraView,
  scanFromURLAsync,
  useCameraPermissions,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { requestJoinByInviteCode } from "@/services/groupService";
import { chatService } from "@/services/chat";
import { apiFetch } from "@/services/fetchClient";

type WebQrLoginPayload = {
  sessionId: string;
  confirmCode: string;
};

type NoticeModalState = {
  title: string;
  message: string;
};

export default function QRScanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [pendingWebLogin, setPendingWebLogin] = useState<WebQrLoginPayload | null>(null);
  const [noticeModal, setNoticeModal] = useState<NoticeModalState | null>(null);
  const [isSubmittingWebLogin, setIsSubmittingWebLogin] = useState(false);
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  useEffect(() => {
    const getPermission = async () => {
      await requestPermission();
    };

    getPermission();
  }, [requestPermission]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/chat" as Href);
  };

  const renderBackButton = () => (
    <TouchableOpacity
      style={[styles.backButton, { top: insets.top + 12 }]}
      onPress={handleGoBack}
      activeOpacity={0.82}
    >
      <Ionicons name="chevron-back" size={24} color="#fff" />
      <Text style={styles.backButtonText}>Quay lại</Text>
    </TouchableOpacity>
  );

  const getJoinErrorMessage = (message?: string) => {
    const normalized = String(message || "").trim().toLowerCase();

    if (
      normalized.includes("already in this group")
      || normalized.includes("already a member")
      || normalized.includes("already joined")
    ) {
      return "Bạn đã là thành viên của nhóm này rồi.";
    }

    return message || "Không thể gửi yêu cầu tham gia nhóm.";
  };

  const showNotice = (title: string, message: string) => {
    setNoticeModal({ title, message });
  };

  const extractInviteCode = (rawData: string): string | null => {
    const trimmed = String(rawData || "").trim();
    if (!trimmed) return null;

    const directMatch = /^(?:groupInvite|inviteCode):(.+)$/i.exec(trimmed);
    if (directMatch?.[1]) {
      return String(directMatch[1]).trim();
    }

    try {
      const parsedUrl = new URL(trimmed);
      const code = parsedUrl.searchParams.get("code") || parsedUrl.searchParams.get("inviteCode");
      if (code?.trim()) {
        return code.trim();
      }
    } catch (_error) {
      // Not a URL, continue fallback parsing.
    }

    const fallbackMatch = /(?:\?|&|^)code=([^&]+)/i.exec(trimmed);
    if (fallbackMatch?.[1]) {
      return decodeURIComponent(fallbackMatch[1]).trim();
    }

    return null;
  };

  const extractWebLoginPayload = (rawData: string): WebQrLoginPayload | null => {
    const trimmed = String(rawData || "").trim();
    if (!trimmed) return null;

    const directMatch = /^(?:taklo:\/\/)?qr-login\?(.+)$/i.exec(trimmed);
    if (directMatch?.[1]) {
      const params = new URLSearchParams(directMatch[1]);
      const sid = params.get("sid") || params.get("sessionId");
      const code = params.get("code") || params.get("confirmCode");
      if (sid && code) {
        return { sessionId: sid.trim(), confirmCode: code.trim() };
      }
    }

    try {
      const parsedUrl = new URL(trimmed);
      const isTakloQrLogin =
        parsedUrl.protocol.toLowerCase() === "taklo:"
        && parsedUrl.host.toLowerCase() === "qr-login";

      if (isTakloQrLogin) {
        const sid = parsedUrl.searchParams.get("sid") || parsedUrl.searchParams.get("sessionId");
        const code = parsedUrl.searchParams.get("code") || parsedUrl.searchParams.get("confirmCode");
        if (sid && code) {
          return { sessionId: sid.trim(), confirmCode: code.trim() };
        }
      }
    } catch (_error) {
      // Ignore URL parse error.
    }

    const sidMatch = /(?:\?|&|^)sid=([^&]+)/i.exec(trimmed);
    const codeMatch = /(?:\?|&|^)code=([^&]+)/i.exec(trimmed);
    if (sidMatch?.[1] && codeMatch?.[1]) {
      return {
        sessionId: decodeURIComponent(sidMatch[1]).trim(),
        confirmCode: decodeURIComponent(codeMatch[1]).trim(),
      };
    }

    return null;
  };

  const handleSubmitJoinRequest = async () => {
    if (!pendingInviteCode || isSubmittingJoin) return;

    try {
      setIsSubmittingJoin(true);
      const result = await requestJoinByInviteCode(pendingInviteCode);

      if (result.status === "joined") {
        const joinedGroupId = String(
          result.group?.id || result.group?._id || result.groupId || "",
        );
        await chatService.loadConversations();

        if (joinedGroupId) {
          router.replace({
            pathname: "/(tabs)/chat/[conversationId]",
            params: { conversationId: joinedGroupId },
          });
          return;
        }

        showNotice("Tham gia nhóm", "Đã tham gia nhóm thành công.");
      } else if (result.status === "requested" || result.status === "pending") {
        showNotice("Đã gửi yêu cầu", "Yêu cầu tham gia nhóm đã được gửi. Vui lòng chờ trưởng nhóm duyệt.");
      } else {
        showNotice("Tham gia nhóm", result.message || "Đã xử lý yêu cầu tham gia nhóm.");
      }
    } catch (error: any) {
      showNotice("Không thể tham gia nhóm", getJoinErrorMessage(error?.message));
    } finally {
      setIsSubmittingJoin(false);
      setPendingInviteCode(null);
      setScanned(false);
    }
  };

  const handleConfirmWebLogin = async () => {
    if (!pendingWebLogin || isSubmittingWebLogin) return;

    try {
      setIsSubmittingWebLogin(true);
      await apiFetch<{ message: string }>("/api/users/qr-login/confirm", {
        method: "POST",
        body: {
          sessionId: pendingWebLogin.sessionId,
          confirmCode: pendingWebLogin.confirmCode,
        },
      });
      alert("Da xac nhan dang nhap web thanh cong.");
    } catch (error: any) {
      alert(error?.message || "Khong the xac nhan dang nhap web.");
    } finally {
      setIsSubmittingWebLogin(false);
      setPendingWebLogin(null);
      setScanned(false);
    }
  };

  const navigateByQrData = (data: string) => {
    const normalizedData = String(data || "").trim();
    setScanned(true);

    const webLoginPayload = extractWebLoginPayload(normalizedData);
    if (webLoginPayload) {
      setPendingWebLogin(webLoginPayload);
      return;
    }

    const userMatch = /^userId:(.+)$/i.exec(normalizedData);
    if (userMatch?.[1]) {
      const userId = userMatch[1];
      router.replace({
        pathname: "/friends/UserSearchResult",
        params: { userId: String(userId) },
      });
      return;
    }

    const inviteCode = extractInviteCode(normalizedData);
    if (inviteCode) {
      setPendingInviteCode(inviteCode);
      return;
    }

    alert("Mã QR không hợp lệ");
  };

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    navigateByQrData(data);
  };

  const handlePickImageAndScan = async () => {
    if (isPickingImage) return;

    try {
      setIsPickingImage(true);

      const mediaPermission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!mediaPermission.granted) {
        alert("Bạn cần cấp quyền thư viện ảnh để quét QR từ ảnh.");
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (picked.canceled || !picked.assets?.[0]?.uri) {
        return;
      }

      const scannedResults = await scanFromURLAsync(picked.assets[0].uri, [
        "qr",
      ]);
      if (!scannedResults.length) {
        alert("Không tìm thấy mã QR trong ảnh.");
        return;
      }

      navigateByQrData(scannedResults[0].data);
    } catch (error) {
      console.error("Scan QR from gallery failed:", error);
      alert("Không thể quét QR từ ảnh. Vui lòng thử lại.");
    } finally {
      setIsPickingImage(false);
    }
  };

  if (!permission) {
    return <Text>Đang xin quyền camera...</Text>;
  }

  if (!permission.granted) {
    return <Text>Không có quyền truy cập camera</Text>;
  }

  return (
    <View style={styles.container}>
      <CameraView
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />

      {renderBackButton()}

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, isPickingImage && styles.disabledButton]}
          onPress={handlePickImageAndScan}
          activeOpacity={0.8}
          disabled={isPickingImage}
        >
          {isPickingImage ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Chọn ảnh từ thư viện</Text>
          )}
        </TouchableOpacity>

        {scanned && (
          <View style={styles.rescanButtonWrap}>
            <Button title="Quét lại" onPress={() => setScanned(false)} />
          </View>
        )}
      </View>

      <Modal
        visible={Boolean(pendingInviteCode)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (isSubmittingJoin) return;
          setPendingInviteCode(null);
          setScanned(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Xin tham gia nhóm?</Text>
            <Text style={styles.modalSubtitle}>
              Mã mời: {pendingInviteCode || "---"}
            </Text>
            <Text style={styles.modalHint}>
              Bạn muốn gửi yêu cầu tham gia nhóm bằng mã QR vừa quét.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  if (isSubmittingJoin) return;
                  setPendingInviteCode(null);
                  setScanned(false);
                }}
                disabled={isSubmittingJoin}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleSubmitJoinRequest}
                disabled={isSubmittingJoin}
              >
                {isSubmittingJoin ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Gửi yêu cầu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(pendingWebLogin)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (isSubmittingWebLogin) return;
          setPendingWebLogin(null);
          setScanned(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Xac nhan dang nhap web?</Text>
            <Text style={styles.modalSubtitle}>Web session: {pendingWebLogin?.sessionId || "---"}</Text>
            <Text style={styles.modalHint}>
              Neu ban vua mo trang dang nhap web, bam "Xac nhan" de dang nhap cho trinh duyet do.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  if (isSubmittingWebLogin) return;
                  setPendingWebLogin(null);
                  setScanned(false);
                }}
                disabled={isSubmittingWebLogin}
              >
                <Text style={styles.cancelButtonText}>Huy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmWebLogin}
                disabled={isSubmittingWebLogin}
              >
                {isSubmittingWebLogin ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Xac nhan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(noticeModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setNoticeModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.noticeCard}>
            <View style={styles.noticeIconWrap}>
              <Ionicons name="information-circle" size={30} color="#2563EB" />
            </View>
            <Text style={styles.noticeTitle}>{noticeModal?.title}</Text>
            <Text style={styles.noticeMessage}>{noticeModal?.message}</Text>
            <TouchableOpacity
              style={styles.noticeButton}
              onPress={() => setNoticeModal(null)}
              activeOpacity={0.86}
            >
              <Text style={styles.noticeButtonText}>Đã hiểu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    left: 16,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "rgba(17, 24, 39, 0.68)",
    paddingVertical: 9,
    paddingLeft: 8,
    paddingRight: 14,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  actionsContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    gap: 12,
  },
  actionButton: {
    backgroundColor: "#0068FF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.75,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  rescanButtonWrap: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 12,
    overflow: "hidden",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
  },
  noticeCard: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
  },
  noticeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    marginBottom: 12,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  noticeMessage: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: "#4B5563",
    textAlign: "center",
  },
  noticeButton: {
    marginTop: 18,
    width: "100%",
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0068FF",
  },
  noticeButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalSubtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#1D4ED8",
  },
  modalHint: {
    marginTop: 8,
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  modalActions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalButton: {
    minWidth: 100,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
  },
  cancelButtonText: {
    color: "#374151",
    fontWeight: "600",
  },
  confirmButton: {
    backgroundColor: "#0068FF",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
