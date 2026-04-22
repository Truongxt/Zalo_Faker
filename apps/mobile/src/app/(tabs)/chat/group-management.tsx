import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Switch,
  ActivityIndicator,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { GrayToast } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { socketService } from "@/lib/socket";
import {
  addGroupMember,
  removeGroupMember,
  leaveGroup,
  transferAdmin,
  appointDeputy,
  revokeDeputy,
  dissolveGroup,
  getGroupSettings,
  rotateGroupInviteCode,
  updateGroupInviteSettings,
  getGroupJoinRequests,
  reviewGroupJoinRequest,
  updateGroupPermissions,
  renameGroup,
  updateGroupAvatar,
} from "@/services/groupService";
import * as ImagePicker from "expo-image-picker";
import { uploadFile } from "@/services/chat";
import { Avatar } from "@/components/ui/Avatar";
import { friendsService, userService } from "@/services";
import type { GroupPermissionScope } from "@/types";

const permissionOptions: Array<{ value: GroupPermissionScope; label: string }> = [
  { value: "all", label: "Tất cả thành viên" },
  { value: "admin_deputy", label: "Admin + Phó nhóm" },
  { value: "admin", label: "Chỉ Admin" },
];

export default function GroupManagementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerTopPadding = Math.max(insets.top, 10);
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const id = String(conversationId || "");

  const { user } = useAuthStore();
  const { conversations, updateConversation, removeConversation, setActiveConversation } =
    useChatStore();

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<any>({
    invite: { code: "", approvalRequired: true, inviteUrl: "" },
    permissions: { sendMedia: "all", pinMessage: "admin_deputy", sendAnnouncement: "admin_deputy" },
    pendingJoinRequests: [],
  });

  const group = useMemo(
    () => conversations.find((item) => String(item.id) === id),
    [conversations, id]
  );

  useEffect(() => {
    if (!id || !user) return;

    const loadUsersAndSettings = async () => {
      try {
        const [relations, latestSettings, joinRequests] = await Promise.all([
          friendsService.getFriend(user.id),
          getGroupSettings(id),
          getGroupJoinRequests(id).catch(() => ({ requests: [] })),
        ]);

        const friendIds = relations.map((friend) =>
          String(friend.fromUserId) === String(user.id)
            ? String(friend.toUserId)
            : String(friend.fromUserId),
        );

        const uniqueFriendIds = [...new Set(friendIds)];
        setFriendIds(uniqueFriendIds);

        const participantIds = group.participants.map((p: any) => String(p.userId));
        const requesterIds = (joinRequests as any)?.requests?.map((r: any) => String(r.userId)) || [];
        
        const allNeededIds = [...new Set([...uniqueFriendIds, ...participantIds, ...requesterIds])];
        
        const users = await Promise.all(
          allNeededIds.map((uId) => userService.getUserById(uId).catch(() => null)),
        );

        setAllUsers(users.filter(Boolean) as any[]);

        if (latestSettings) {
          setSettings({
            invite: {
              code: latestSettings?.invite?.code || "",
              approvalRequired: Boolean(latestSettings?.invite?.approvalRequired),
              inviteUrl: latestSettings?.invite?.inviteUrl || "",
            },
            permissions: {
              sendMedia: latestSettings?.permissions?.sendMedia || "all",
              pinMessage: latestSettings?.permissions?.pinMessage || "admin_deputy",
              sendAnnouncement: latestSettings?.permissions?.sendAnnouncement || "admin_deputy",
            },
            pendingJoinRequests:
              joinRequests?.requests || latestSettings?.pendingJoinRequests || [],
          });
        }
      } catch (error) {
        console.error("Error loading group settings:", error);
      }
    };

    loadUsersAndSettings();
  }, [id, user]);

  useEffect(() => {
    if (!id || !user || !group) return;

    const socket = socketService.getSocket() || socketService.connect();
    if (!socket) return;

    const onUpdateConversation = async ({
      id: incomingId,
      ...updates
    }: {
      id: string;
      [key: string]: any;
    }) => {
      if (String(incomingId) !== String(id)) return;
      if (!updates?.groupSettings && !updates?.participants) return;

      try {
        const effectiveParticipants = updates?.participants || group.participants || [];

        const currentRole = effectiveParticipants.find(
          (participant) => String(participant.userId) === String(user.id),
        )?.role;
        const canReview = currentRole === "admin" || currentRole === "deputy";

        const [latestSettings, joinRequests] = await Promise.all([
          getGroupSettings(id),
          canReview
            ? getGroupJoinRequests(id).catch(() => ({ requests: [] }))
            : Promise.resolve({ requests: [] }),
        ]);

        const nextSettings = {
          invite: {
            code: latestSettings?.invite?.code || "",
            approvalRequired: Boolean(latestSettings?.invite?.approvalRequired),
            inviteUrl: latestSettings?.invite?.inviteUrl || "",
          },
          permissions: {
            sendMedia: latestSettings?.permissions?.sendMedia || "all",
            pinMessage: latestSettings?.permissions?.pinMessage || "admin_deputy",
            sendAnnouncement:
              latestSettings?.permissions?.sendAnnouncement || "admin_deputy",
          },
          pendingJoinRequests:
            (joinRequests as any)?.requests ||
            latestSettings?.pendingJoinRequests ||
            [],
        };

        setSettings(nextSettings);
        updateConversation(id, {
          participants: effectiveParticipants,
          groupSettings: {
            invite: {
              code: nextSettings.invite.code,
              approvalRequired: nextSettings.invite.approvalRequired,
            },
            joinRequests: nextSettings.pendingJoinRequests,
            permissions: nextSettings.permissions,
            pinnedMessage:
              latestSettings?.pinnedMessage ||
              updates?.groupSettings?.pinnedMessage ||
              group.groupSettings?.pinnedMessage ||
              null,
          },
        });
      } catch (error) {
        console.error("Realtime group settings refresh failed:", error);
      }
    };

    socket.on("chat:update_conversation", onUpdateConversation);
    return () => {
      socket.off("chat:update_conversation", onUpdateConversation);
    };
  }, [id, user, group, updateConversation]);

  const participantsMap = useMemo(() => {
    const map = new Map<string, any>();
    allUsers.forEach((u) => {
      const uId = String(u.id || u._id || u.userId || "");
      if (uId) map.set(uId, u);
    });
    return map;
  }, [allUsers]);

  if (!group || !user) return null;

  const currentUserParticipant = group.participants.find((p) => String(p.userId) === String(user.id));
  const isAdmin = currentUserParticipant?.role === "admin";
  const canReviewRequests =
    currentUserParticipant?.role === "admin" || currentUserParticipant?.role === "deputy";

  const availableUsersToAdd = allUsers.filter(
    (u) => {
      const uId = String(u.id || u._id || u.userId);
      return friendIds.includes(uId) && !group.participants.some((p) => String(p.userId) === uId);
    }
  );

  const transferCandidates = group.participants.filter(
    (participant) => String(participant.userId) !== String(user.id),
  );

  const syncParticipants = (participants: any[] | undefined) => {
    if (participants) {
      updateConversation(id, { participants });
    }
  };

  const handleRename = useCallback(() => {
    if (!group) return;
    Alert.prompt(
      "Đổi tên nhóm",
      "Nhập tên mới cho nhóm của bạn",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đổi tên",
          onPress: async (newName) => {
            if (!newName?.trim()) return;
            try {
              setIsLoading(true);
              await renameGroup(id, newName.trim());
              updateConversation(id, { name: newName.trim() });
              GrayToast("Đã đổi tên nhóm");
            } catch (error: any) {
              GrayToast(error?.message || "Không thể đổi tên nhóm");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
      "plain-text",
      group.name
    );
  }, [group, id, updateConversation]);

  const handleAvatarChange = async () => {
    if (!group) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) return;

      setIsLoading(true);
      const url = await uploadFile(
        asset.uri,
        asset.fileName || "avatar.jpg",
        asset.mimeType || "image/jpeg",
        accessToken,
      );

      await updateGroupAvatar(id, url);
      updateConversation(id, { avatar: url });
      GrayToast("Đã cập nhật ảnh đại diện nhóm");
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể cập nhật ảnh đại diện");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (value: string, message: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    GrayToast(message);
  };

  const handleToggleInviteApproval = async (checked: boolean) => {
    try {
      setIsLoading(true);
      await updateGroupInviteSettings(id, { approvalRequired: checked });
      setSettings((prev: any) => ({
        ...prev,
        invite: { ...prev.invite, approvalRequired: checked },
      }));
    } catch {
      GrayToast("Không thể cập nhật cài đặt mời");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRotateInvite = async () => {
    try {
      setIsLoading(true);
      const result = await rotateGroupInviteCode(id);
      setSettings((prev: any) => ({
        ...prev,
        invite: {
          code: result.invite?.code || prev.invite.code,
          inviteUrl: result.invite?.inviteUrl || prev.invite.inviteUrl,
        },
      }));
      GrayToast("Đã tạo mới mã mời");
    } catch {
      GrayToast("Không tạo được mã mới");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewRequest = async (requestId: string, action: "approve" | "reject") => {
    try {
      setIsLoading(true);
      const result = await reviewGroupJoinRequest(id, requestId, action);
      if (result.group?.participants) {
        updateConversation(id, { participants: result.group.participants });
      }
      setSettings((prev: any) => ({
        ...prev,
        pendingJoinRequests: prev.pendingJoinRequests.filter(
          (r: any) => String(r.requestId) !== String(requestId)
        ),
      }));
      GrayToast(action === "approve" ? "Đã duyệt yêu cầu" : "Đã từ chối yêu cầu");
    } catch {
      GrayToast("Xử lý thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (newUserId: string) => {
    Alert.alert("Xác nhận", "Thêm người này vào nhóm?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Thêm",
        onPress: async () => {
          try {
            setIsLoading(true);
            const res = await addGroupMember(id, { userId: String(user.id), newUserId });
            if (res.participants) {
              updateConversation(id, { participants: res.participants });
            }
            setShowAddMember(false);
            GrayToast("Đã thêm thành viên");
          } catch (error: any) {
            GrayToast(error.message || "Lỗi khi thêm");
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const handleRemoveMember = async (removeUserId: string) => {
    Alert.alert("Khách mời", "Xóa người này khỏi nhóm?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            setIsLoading(true);
            const res = await removeGroupMember(id, { userId: String(user.id), removeUserId });
            if (res.group?.participants) {
              updateConversation(id, { participants: res.group.participants });
            }
            GrayToast("Đã xóa thành viên");
          } catch (error: any) {
            GrayToast(error.message || "Lỗi xóa thành viên");
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const handleTransferAdmin = async (newAdminUserId: string) => {
    try {
      setIsLoading(true);
      const res = await transferAdmin(id, {
        userId: String(user.id),
        newAdminUserId,
      });
      syncParticipants(res.group?.participants);
      GrayToast("Đã chuyển quyền trưởng nhóm");
    } catch (error: any) {
      GrayToast(error.message || "Không thể chuyển quyền trưởng nhóm");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDeputy = async (participant: any) => {
    const isDeputy = participant.role === "deputy";
    try {
      setIsLoading(true);
      const res = isDeputy
        ? await revokeDeputy(id, {
            userId: String(user.id),
            deputyUserId: String(participant.userId),
          })
        : await appointDeputy(id, {
            userId: String(user.id),
            deputyUserId: String(participant.userId),
          });
      syncParticipants(res.group?.participants);
      GrayToast(isDeputy ? "Đã thu hồi quyền phó nhóm" : "Đã cấp quyền phó nhóm");
    } catch (error: any) {
      GrayToast(error.message || "Không thể cập nhật quyền phó nhóm");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMemberActions = (participant: any) => {
    const isMe = String(participant.userId) === String(user.id);
    if (isMe) return;

    const participantName = getParticipantName(participant.userId, participant.nickname);
    const options: Array<{ text: string; style?: "cancel" | "destructive"; onPress?: () => void }> = [];

    if (isAdmin) {
      options.push({
        text: participant.role === "deputy" ? "Thu hồi quyền phó nhóm" : "Cấp quyền phó nhóm",
        onPress: () => {
          void handleToggleDeputy(participant);
        },
      });
      options.push({
        text: "Chuyển quyền trưởng nhóm",
        onPress: () => {
          Alert.alert(
            "Chuyển quyền trưởng nhóm",
            `Chuyển quyền trưởng nhóm cho ${participantName}?`,
            [
              { text: "Hủy", style: "cancel" },
              {
                text: "Chuyển quyền",
                onPress: () => {
                  void handleTransferAdmin(String(participant.userId));
                },
              },
            ],
          );
        },
      });
      options.push({
        text: "Xóa khỏi nhóm",
        style: "destructive",
        onPress: () => {
          void handleRemoveMember(String(participant.userId));
        },
      });
    } else if (currentUserParticipant?.role === "deputy" && participant.role === "member") {
      options.push({
        text: "Xóa khỏi nhóm",
        style: "destructive",
        onPress: () => {
          void handleRemoveMember(String(participant.userId));
        },
      });
    }

    options.push({ text: "Hủy", style: "cancel" });
    Alert.alert(participantName, "Chọn thao tác", options);
  };

  const finalizeGroupExit = () => {
    setActiveConversation(null);
    removeConversation(id);
    router.replace("/(tabs)/chat/chats");
  };

  const handleLeaveGroup = async () => {
    if (isAdmin) {
      if (transferCandidates.length === 0) {
        GrayToast("Bạn cần chọn trưởng nhóm mới trước khi rời nhóm");
        return;
      }

      Alert.alert(
        "Chuyển quyền trước khi rời nhóm",
        "Hãy chọn một thành viên để chuyển quyền trưởng nhóm.",
        [
          ...transferCandidates.map((participant) => ({
            text: getParticipantName(participant.userId, participant.nickname),
            onPress: async () => {
              try {
                setIsLoading(true);
                await leaveGroup(id, {
                  userId: String(user.id),
                  newAdminUserId: String(participant.userId),
                });
                GrayToast("Đã chuyển quyền trưởng nhóm và rời nhóm");
                finalizeGroupExit();
              } catch (error: any) {
                GrayToast(error.message || "Không thể rời nhóm");
              } finally {
                setIsLoading(false);
              }
            },
          })),
          { text: "Hủy", style: "cancel" },
        ],
      );
      return;
    }

    Alert.alert("Rời nhóm", "Bạn có chắc muốn rời nhóm này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Rời nhóm",
        style: "destructive",
        onPress: async () => {
          try {
            setIsLoading(true);
            await leaveGroup(id, { userId: String(user.id) });
            finalizeGroupExit();
          } catch (error: any) {
            GrayToast(error.message || "Lỗi khi rời nhóm");
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const handleDissolveGroup = () => {
    Alert.alert("Giải tán nhóm", "Bạn có chắc muốn giải tán nhóm này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Giải tán",
        style: "destructive",
        onPress: async () => {
          try {
            setIsLoading(true);
            await dissolveGroup(id, { userId: String(user.id) });
            GrayToast("Đã giải tán nhóm");
            finalizeGroupExit();
          } catch (error: any) {
            GrayToast(error.message || "Không thể giải tán nhóm");
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const handleUpdatePermission = async (key: string) => {
    Alert.alert(
      "Chọn quyền",
      undefined,
      permissionOptions.map((opt) => ({
        text: opt.label,
        onPress: async () => {
          try {
            setIsLoading(true);
            const result = await updateGroupPermissions(id, { [key]: opt.value });
            setSettings((prev: any) => ({
              ...prev,
              permissions: { ...prev.permissions, ...(result.permissions || {}) },
            }));
            GrayToast("Đã cập nhật quyền");
          } catch {
            GrayToast("Cập nhật thất bại");
          } finally {
            setIsLoading(false);
          }
        },
      }))
    );
  };

  const getParticipantName = (pId: string, fallback?: string) => {
    const userInfo = participantsMap.get(String(pId));
    return userInfo?.fullName || userInfo?.userName || fallback || `User ${pId}`;
  };

  const inviteQrValue = String(
    settings?.invite?.inviteUrl ||
      (settings?.invite?.code ? `groupInvite:${settings.invite.code}` : ""),
  ).trim();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F3F4F6" }} edges={["bottom"]}>
      {/* Header */}
      <View
        style={{
          paddingTop: headerTopPadding,
          paddingBottom: 10,
          paddingHorizontal: 12,
          backgroundColor: "#3B82F6",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center" }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 4, flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={handleAvatarChange} style={{ marginRight: 12 }}>
            <View>
              <Avatar uri={group?.avatar} name={group?.name} size={40} />
              <View style={{ position: "absolute", bottom: -2, right: -2, backgroundColor: "#FFF", borderRadius: 10, padding: 2 }}>
                <Ionicons name="camera" size={10} color="#3B82F6" />
              </View>
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#FFF" }} numberOfLines={1}>{group?.name}</Text>
              <TouchableOpacity onPress={handleRename} style={{ marginLeft: 6 }}>
                <Ionicons name="create-outline" size={16} color="#DBEAFE" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: "#DBEAFE" }}>Quản trị nhóm</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Thông tin nhóm chi tiết */}
        <View style={{ backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16, alignItems: "center" }}>
          <TouchableOpacity onPress={handleAvatarChange} style={{ marginBottom: 12 }}>
            <View>
              <Avatar uri={group?.avatar} name={group?.name} size={80} />
              <View style={{ position: "absolute", bottom: 0, right: 0, backgroundColor: "#3B82F6", borderRadius: 15, padding: 6, borderWidth: 2, borderColor: "#FFF" }}>
                <Ionicons name="camera" size={18} color="#FFF" />
              </View>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleRename} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#1F2937", textAlign: "center" }}>{group?.name}</Text>
            <Ionicons name="create-outline" size={20} color="#3B82F6" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
          <Text style={{ fontSize: 13, color: "#6B7280" }}>Chạm vào ảnh hoặc tên để thay đổi</Text>
        </View>

        {/* Link Mời Nhóm */}
        <View style={{ backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="link" size={20} color="#6366F1" />
              <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: "600", color: "#1F2937" }}>
                Link mời nhóm
              </Text>
            </View>
            {(isAdmin || canReviewRequests) && (
              <TouchableOpacity onPress={handleRotateInvite} disabled={isLoading}>
                <Text style={{ color: "#4F46E5", fontWeight: "600", fontSize: 13 }}>Tạo lại mã</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ backgroundColor: "#F9FAFB", padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600", marginBottom: 4 }}>MÃ MỜI</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", letterSpacing: 1 }}>{settings.invite.code || "---"}</Text>
            </View>
            <TouchableOpacity onPress={() => copyToClipboard(settings.invite.code, "Đã copy mã mời")}>
              <Ionicons name="copy-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: "#F9FAFB", padding: 12, borderRadius: 8, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600", marginBottom: 4 }}>LINK THAM GIA</Text>
              <Text style={{ fontSize: 12, color: "#374151" }} numberOfLines={1}>{settings.invite.inviteUrl || "---"}</Text>
            </View>
            <TouchableOpacity onPress={() => copyToClipboard(settings.invite.inviteUrl, "Đã copy link mời")}>
              <Ionicons name="copy-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {inviteQrValue ? (
            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 8,
                padding: 12,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600", marginBottom: 8 }}>
                MÃ QR THAM GIA
              </Text>
              <View
                style={{
                  backgroundColor: "#fff",
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <QRCode value={inviteQrValue} size={136} />
              </View>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "#6B7280",
                  textAlign: "center",
                }}
              >
                Quét mã để xin tham gia nhóm
              </Text>
            </View>
          ) : null}

          {canReviewRequests && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 14, color: "#374151" }}>Bắt buộc duyệt thành viên mới</Text>
              <Switch
                value={settings.invite.approvalRequired}
                onValueChange={handleToggleInviteApproval}
                disabled={isLoading}
              />
            </View>
          )}
        </View>

        {/* Yêu cầu tham gia */}
        {canReviewRequests && (
          <View style={{ backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Ionicons name="people-circle-outline" size={20} color="#F59E0B" />
              <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: "600", color: "#1F2937" }}>
                Yêu cầu tham gia
              </Text>
              {settings.pendingJoinRequests.length > 0 && (
                <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 8 }}>
                  <Text style={{ color: "#D97706", fontSize: 12, fontWeight: "600" }}>{settings.pendingJoinRequests.length}</Text>
                </View>
              )}
            </View>

            {settings.pendingJoinRequests.length === 0 ? (
              <Text style={{ textAlign: "center", color: "#9CA3AF", paddingVertical: 10 }}>Không có yêu cầu nào</Text>
            ) : (
              settings.pendingJoinRequests.map((req: any) => (
                <View key={req.requestId} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600", color: "#1F2937" }}>{getParticipantName(req.userId)}</Text>
                    <Text style={{ fontSize: 11, color: "#6B7280" }}>{new Date(req.requestedAt).toLocaleString("vi-VN")}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity onPress={() => handleReviewRequest(req.requestId, "reject")} disabled={isLoading} style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                      <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 12 }}>Từ chối</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleReviewRequest(req.requestId, "approve")} disabled={isLoading} style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                      <Text style={{ color: "#10B981", fontWeight: "600", fontSize: 12 }}>Duyệt</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Phân quyền */}
        {isAdmin && (
          <View style={{ backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Ionicons name="settings-outline" size={20} color="#8B5CF6" />
              <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: "600", color: "#1F2937" }}>Phân quyền nhóm</Text>
            </View>
            <TouchableOpacity onPress={() => handleUpdatePermission("sendMedia")} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}>
              <Text style={{ color: "#374151" }}>Gửi ảnh/video/file</Text>
              <Text style={{ color: "#6B7280", fontWeight: "500" }}>
                {permissionOptions.find((o) => o.value === settings.permissions.sendMedia)?.label}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleUpdatePermission("pinMessage")} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}>
              <Text style={{ color: "#374151" }}>Ghim tin nhắn</Text>
              <Text style={{ color: "#6B7280", fontWeight: "500" }}>
                {permissionOptions.find((o) => o.value === settings.permissions.pinMessage)?.label}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleUpdatePermission("sendAnnouncement")} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 }}>
              <Text style={{ color: "#374151" }}>Gửi thông báo</Text>
              <Text style={{ color: "#6B7280", fontWeight: "500" }}>
                {permissionOptions.find((o) => o.value === settings.permissions.sendAnnouncement)?.label}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Thành viên */}
        <View style={{ backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="people" size={20} color="#10B981" />
              <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: "600", color: "#1F2937" }}> Thành viên ({group.participants.length})</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAddMember(!showAddMember)} style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: "#059669", fontWeight: "600", fontSize: 13 }}>+ Thêm</Text>
            </TouchableOpacity>
          </View>

          {showAddMember && (
            <View style={{ backgroundColor: "#F9FAFB", padding: 10, borderRadius: 8, marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>Chọn người thêm vào nhóm</Text>
              {availableUsersToAdd.length === 0 ? (
                <Text style={{ fontSize: 13, color: "#9CA3AF" }}>Không còn ai để thêm</Text>
              ) : (
                availableUsersToAdd.map((u) => (
                  <TouchableOpacity key={u.id || u.userId} onPress={() => handleAddMember(String(u.id || u.userId))} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
                    <Text style={{ color: "#374151", fontWeight: "500" }}>{u.fullName || u.userName}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {group.participants.map((p) => {
            const isMe = String(p.userId) === String(user.id);
            const canManage =
              !isMe &&
              (isAdmin ||
                (currentUserParticipant?.role === "deputy" && p.role === "member"));
            return (
              <View key={p.userId} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}>
                <View>
                  <Text style={{ fontWeight: "600", color: "#1F2937", fontSize: 15 }}>
                    {getParticipantName(p.userId, p.nickname)} {isMe && "(Bạn)"}
                  </Text>
                  <Text style={{ fontSize: 12, color: p.role === "admin" ? "#F59E0B" : p.role === "deputy" ? "#3B82F6" : "#9CA3AF" }}>
                    {p.role === "admin" ? "Trưởng nhóm" : p.role === "deputy" ? "Phó nhóm" : "Thành viên"}
                  </Text>
                </View>
                {canManage && (
                  <TouchableOpacity onPress={() => handleMemberActions(p)} style={{ padding: 4 }}>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {isAdmin && (
          <TouchableOpacity
            onPress={handleDissolveGroup}
            disabled={isLoading}
            style={{ backgroundColor: "#FFF7ED", borderColor: "#FDBA74", borderWidth: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 12 }}
          >
            <Text style={{ color: "#EA580C", fontSize: 15, fontWeight: "600" }}>Giải tán nhóm</Text>
          </TouchableOpacity>
        )}

        {/* Nút rời nhóm */}
        <TouchableOpacity
          onPress={handleLeaveGroup}
          disabled={isLoading || group.participants.length === 1}
          style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderWidth: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 40 }}
        >
          <Text style={{ color: "#EF4444", fontSize: 15, fontWeight: "600" }}>{isAdmin ? "Chuyển quyền và rời nhóm" : "Rời nhóm"}</Text>
        </TouchableOpacity>
      </ScrollView>

      {isLoading && (
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}
    </SafeAreaView>
  );
}
