import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ImageBackground,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { uploadFile } from "@/services/chat";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { GrayToast } from "@/components/ui";
import { ChatOptionsModal } from "@/components/chat/ChatOptionsModal";
import { ForwardMessageModal } from "@/components/chat/ForwardMessageModal";
import { VoiceMessagePlayer } from "@/components/chat/VoiceMessagePlayer";
import { Audio } from "expo-av";
import Svg, { Path, Line } from "react-native-svg";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { chatService } from "@/services/chat";

import { socketService } from "@/lib/socket";
import {
  getGroupById,
  pinGroupMessage,
  unpinGroupMessage,
} from "@/services/groupService";
import { STICKER_URLS } from "@/constants/stickers";
import { API_URL } from "@/constants/config";
import type { Message } from "@/types";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

const isImageBackground = (value?: string | null) =>
  Boolean(value && /^(https?:\/\/|data:|blob:|\/)/i.test(value.trim()));

const getFullMediaUrl = (url?: string) => {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) {
    const base = API_URL.replace(/\/+$/, "");
    return `${base}${trimmed}`;
  }
  return trimmed;
};

const getSolidBackgroundColor = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "#F9FAFB";

  if (/^linear-gradient/i.test(normalized)) {
    const colors = normalized.match(/#(?:[0-9a-fA-F]{3}){1,2}/g);
    return colors?.[0] || "#F9FAFB";
  }

  if (/^(#|rgb)/i.test(normalized)) {
    return normalized;
  }

  return "#F9FAFB";
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const formatRecordingTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

type ReplyPreview = {
  senderName: string;
  content: string;
};

const getReplyMessageId = (
  replyTo: Message["replyTo"] | string | null | undefined,
) => {
  if (!replyTo) return null;
  if (typeof replyTo === "string") return replyTo;
  if (typeof replyTo === "object" && "id" in replyTo && replyTo.id) {
    return String(replyTo.id);
  }
  return null;
};

const getMessagePreviewText = (message: Message | null | undefined) => {
  if (!message) return "Tin nhắn";
  if (message.isDeleted) return "Tin nhắn đã thu hồi";

  switch (message.type) {
    case "image":
      return "[Hình ảnh]";
    case "video":
      return "[Video]";
    case "voice":
      return "[Tin nhắn thoại]";
    case "sticker":
      return "[Sticker]";
    case "file":
      return String((message as any).attachments?.[0]?.name || "").trim() || "[Tập tin]";
    default: {
      if (typeof message.content === "string" && message.content.trim()) {
        return message.content.trim();
      }

      const nestedText = String(
        (message.content as any)?.text
          || (message.content as any)?.message
          || (message.content as any)?.content
          || "",
      ).trim();

      return nestedText || "Tin nhắn";
    }
  }
};

const resolveReplyPreview = (
  replyTo: Message["replyTo"] | string | null | undefined,
  messages: Message[],
): ReplyPreview | null => {
  if (!replyTo) return null;

  if (
    typeof replyTo === "object"
    && "content" in replyTo
    && "senderName" in replyTo
    && typeof replyTo.content === "string"
    && replyTo.content.trim()
  ) {
    return {
      senderName: replyTo.senderName || "Người dùng",
      content: replyTo.content.trim(),
    };
  }

  const replyMessageId = getReplyMessageId(replyTo);
  if (!replyMessageId) return null;

  const targetMessage = messages.find(
    (message) => String(message.id) === String(replyMessageId),
  );

  if (!targetMessage) {
    return {
      senderName:
        typeof replyTo === "object" && "senderName" in replyTo && replyTo.senderName
          ? replyTo.senderName
          : "Người dùng",
      content:
        typeof replyTo === "object" && "content" in replyTo && replyTo.content
          ? replyTo.content
          : "Tin nhắn",
    };
  }

  return {
    senderName: targetMessage.senderName || "Người dùng",
    content: getMessagePreviewText(targetMessage),
  };
};

export default function GroupChatScreen() {
  const params = useLocalSearchParams<{
    groupId?: string;
    conversationId?: string;
  }>();
  const groupId = Array.isArray(params.groupId)
    ? params.groupId[0]
    : params.groupId;
  // Prefer conversationId param, fall back to groupId (both may point to same entity)
  const convId =
    (Array.isArray(params.conversationId)
      ? params.conversationId[0]
      : params.conversationId) ||
    groupId ||
    "";

  const insets = useSafeAreaInsets();
  const headerTopPadding =
    Platform.OS === "ios" ? insets.top + 6 : Math.max(insets.top, 10);
  const { user } = useAuthStore();
  const { messages, conversations, updateConversation } = useChatStore();
  const convMessages: Message[] = (messages as any)[convId] || [];
  const hasCachedMessages = convMessages.length > 0;
  const conversation = conversations.find((item) => item.id === convId);

  const [group, setGroup] = useState<any>(null);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [localPinnedMessage, setLocalPinnedMessage] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const voiceRecordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const myGroupRole = String(
    conversation?.participants?.find(
      (participant) => String(participant.userId) === String(user?.id),
    )?.role || "member",
  ).toLowerCase();
  const pinScope = String(
    conversation?.groupSettings?.permissions?.pinMessage || "admin_deputy",
  ).toLowerCase();
  const canPinInGroup = (() => {
    const roleRank: Record<string, number> = {
      member: 1,
      deputy: 2,
      admin: 3,
    };
    const scopeRank: Record<string, number> = {
      all: 1,
      admin_deputy: 2,
      admin: 3,
    };

    const currentRank = roleRank[myGroupRole] || 0;
    const requiredRank = scopeRank[pinScope] || 2;
    return currentRank >= requiredRank;
  })();

  const pinnedMessage =
    conversation?.groupSettings?.pinnedMessage || localPinnedMessage || null;
  const activeReplyPreview = replyToMessageId
    ? resolveReplyPreview(replyToMessageId, convMessages)
    : null;
  const conversationBackground = String(conversation?.background || "").trim();
  const usesImageBackground = isImageBackground(conversationBackground);
  const chatAreaBackgroundColor = getSolidBackgroundColor(conversationBackground);

  const getPinnedMessagePreview = useCallback((message: any) => {
    if (!message) return "Tin nhắn đã ghim";

    if (message.metadata?.isAnnouncement) {
      const announceText = String(message.content?.text || "").trim();
      return announceText ? `[Thông báo] ${announceText}` : "[Thông báo]";
    }

    const content = message.content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }

    if (content && typeof content === "object") {
      const text = String(
        content.text || content.message || content.content || "",
      ).trim();
      if (text) return text;

      if (typeof content.fileName === "string" && content.fileName.trim()) {
        return `[File] ${content.fileName.trim()}`;
      }
    }

    if (message.type === "image") return "[Hình ảnh]";
    if (message.type === "video") return "[Video]";
    if (message.type === "voice") return "[Tin nhắn thoại]";
    if (message.type === "sticker") return "[Sticker]";
    if (message.type === "file") return "[Tập tin]";
    return "Tin nhắn đã ghim";
  }, []);

  // Load group info
  useEffect(() => {
    if (!groupId) return;
    getGroupById(String(groupId))
      .then((g) => setGroup(g))
      .catch(() => null);
  }, [groupId]);

  // Load messages
  useEffect(() => {
    if (!convId) return;

    let cancelled = false;

    const load = async () => {
      if (hasCachedMessages) {
        setIsLoading(false);
        await chatService.loadMessages(convId).catch(() => null);
        return;
      }

      setIsLoading(true);
      await chatService.loadMessages(convId).catch(() => null);
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [convId, hasCachedMessages]);

  // Socket
  useEffect(() => {
    if (!convId || !user) return;
    const socket = socketService.connect();
    if (!socket) return;
    socketService.joinRoom(convId);

    const onTyping = ({ userId, conversationId: cId }: any) => {
      if (cId !== convId || userId === user.id) return;
      setTypingUsers((prev) =>
        prev.includes(userId) ? prev : [...prev, userId],
      );
      setTimeout(
        () => setTypingUsers((prev) => prev.filter((id) => id !== userId)),
        3000,
      );
    };
    socket.on("chat:typing", onTyping);

    return () => {
      socketService.leaveRoom(convId);
      socket.off("chat:typing", onTyping);
    };
  }, [convId, user?.id]);

  useEffect(() => {
    if (convMessages.length > 0)
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: false }),
        100,
      );
  }, [convMessages.length]);

  useEffect(() => {
    setShowStickerPicker(false);
  }, [convId]);

  useEffect(() => {
    if (conversation?.groupSettings?.pinnedMessage !== undefined) {
      setLocalPinnedMessage(conversation.groupSettings.pinnedMessage || null);
      return;
    }

    const fromGroup = (group as any)?.groupSettings?.pinnedMessage;
    if (fromGroup !== undefined) {
      setLocalPinnedMessage(fromGroup || null);
    }
  }, [conversation?.groupSettings?.pinnedMessage, group]);

  const handleUpdatePinnedMessage = useCallback(
    (nextPinnedMessage: any | null) => {
      setLocalPinnedMessage(nextPinnedMessage);

      if (!conversation) return;

      const fallbackSettings = {
        invite: {
          code: conversation.groupSettings?.invite?.code || "",
          approvalRequired:
            conversation.groupSettings?.invite?.approvalRequired ?? true,
        },
        permissions: {
          sendMedia:
            conversation.groupSettings?.permissions?.sendMedia || "all",
          pinMessage:
            conversation.groupSettings?.permissions?.pinMessage ||
            "admin_deputy",
          sendAnnouncement:
            conversation.groupSettings?.permissions?.sendAnnouncement ||
            "admin_deputy",
        },
        pinnedMessage: null,
      };

      updateConversation(convId, {
        groupSettings: {
          ...(conversation.groupSettings || fallbackSettings),
          pinnedMessage: nextPinnedMessage,
        },
      });
    },
    [convId, conversation, updateConversation],
  );

  useEffect(() => {
    if (!convId || !user) return;

    const socket = socketService.getSocket() || socketService.connect();
    if (!socket) return;

    const onPinnedMessage = ({
      conversationId: incomingConversationId,
      pinnedMessage: nextPinnedMessage,
    }: {
      conversationId: string;
      pinnedMessage: any | null;
    }) => {
      if (String(incomingConversationId) !== String(convId)) return;
      handleUpdatePinnedMessage(nextPinnedMessage || null);
    };

    socket.on("chat:pinned_message", onPinnedMessage);

    return () => {
      socket.off("chat:pinned_message", onPinnedMessage);
    };
  }, [convId, handleUpdatePinnedMessage, user]);

  const handlePinMessage = useCallback(
    async (message: Message) => {
      if (!canPinInGroup) {
        GrayToast("Bạn không có quyền ghim tin nhắn trong nhóm này");
        return;
      }

      if (message.isDeleted) {
        GrayToast("Không thể ghim tin nhắn đã thu hồi");
        return;
      }

      const targetGroupId = String(groupId || convId);
      if (!targetGroupId) return;

      try {
        const result = await pinGroupMessage(targetGroupId, message.id);
        const nextPinned =
          (result as any)?.pinnedMessage ||
          (result as any)?.group?.groupSettings?.pinnedMessage ||
          null;
        handleUpdatePinnedMessage(nextPinned);
        socketService.emit("chat:sync_pinned_message", { conversationId: convId });
        GrayToast("Đã ghim tin nhắn");
      } catch (error: any) {
        GrayToast(error?.message || "Không thể ghim tin nhắn");
      }
    },
    [canPinInGroup, convId, groupId, handleUpdatePinnedMessage],
  );

  const handleUnpinMessage = useCallback(async () => {
    if (!canPinInGroup) {
      GrayToast("Bạn không có quyền bỏ ghim tin nhắn trong nhóm này");
      return;
    }

    const targetGroupId = String(groupId || convId);
    if (!targetGroupId) return;

    try {
      await unpinGroupMessage(targetGroupId);
      handleUpdatePinnedMessage(null);
      socketService.emit("chat:sync_pinned_message", { conversationId: convId });
      GrayToast("Đã bỏ ghim tin nhắn");
    } catch (error: any) {
      GrayToast(error?.message || "Không thể bỏ ghim tin nhắn");
    }
  }, [canPinInGroup, convId, groupId, handleUpdatePinnedMessage]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || !convId) return;
    setText("");
    setIsSending(true);
    try {
      await chatService.sendMessage(convId, {
        type: "text",
        content: trimmed,
        replyTo: replyToMessageId || undefined,
      });
      setReplyToMessageId(null);
    } catch {
      GrayToast("Không thể gửi tin nhắn");
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleStickerPicker = useCallback(() => {
    setShowStickerPicker((prev) => !prev);
  }, []);

  const handleSendSticker = useCallback(
    async (stickerUrl: string) => {
      if (!convId || isSending) return;

      setShowStickerPicker(false);
      setIsSending(true);
      try {
        await chatService.sendMessage(convId, {
          type: "sticker",
          content: stickerUrl,
          replyTo: replyToMessageId || undefined,
        });
        setReplyToMessageId(null);
      } catch {
        GrayToast("Không thể gửi sticker");
      } finally {
        setIsSending(false);
      }
    },
    [convId, isSending, replyToMessageId],
  );

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền", "Hãy cấp quyền truy cập ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;

    setIsSending(true);
    let failedCount = 0;
    let sentCount = 0;

    try {
      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) return;

      for (const [index, asset] of result.assets.entries()) {
        const isVideo = asset.type === "video";
        const name =
          asset.fileName ||
          `media-${Date.now()}-${index}.${isVideo ? "mp4" : "jpg"}`;
        const mimeType =
          asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg");

        try {
          const url = await uploadFile(asset.uri, name, mimeType, accessToken);
          await chatService.sendMessage(convId, {
            type: isVideo ? "video" : "image",
            content: url,
            replyTo: replyToMessageId || undefined,
          });
          sentCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      if (sentCount > 0) {
        setReplyToMessageId(null);
      }

      if (failedCount > 0) {
        if (failedCount === result.assets.length) {
          GrayToast("Không thể gửi ảnh/video");
        } else {
          GrayToast(
            `Đã gửi ${result.assets.length - failedCount}/${result.assets.length} ảnh/video`,
          );
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setIsSending(true);

      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) return;

      const url = await uploadFile(
        asset.uri,
        asset.name,
        asset.mimeType || "application/octet-stream",
        accessToken,
      );
      await chatService.sendMessage(convId, {
        type: "file",
        content: url,
        replyTo: replyToMessageId || undefined,
      });
      setReplyToMessageId(null);
    } catch {
      GrayToast("Không thể gửi file");
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleVoiceRecording = useCallback(async () => {
    if (!convId || isSending) return;

    if (isRecordingVoice) {
      const recording = voiceRecordingRef.current;
      voiceRecordingRef.current = null;
      setIsRecordingVoice(false);
      if (voiceRecordingTimerRef.current) {
        clearInterval(voiceRecordingTimerRef.current);
        voiceRecordingTimerRef.current = null;
      }
      if (!recording) {
        setVoiceRecordingSeconds(0);
        return;
      }

      setIsSending(true);
      try {
        const statusBeforeStop = await recording.getStatusAsync().catch(() => null);
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });

        const durationMillis =
          typeof statusBeforeStop?.durationMillis === "number" &&
          Number.isFinite(statusBeforeStop.durationMillis)
            ? statusBeforeStop.durationMillis
            : voiceRecordingSeconds * 1000;

        if (!uri) throw new Error("Missing recorded audio URI");

        const accessToken = useAuthStore.getState().accessToken;
        if (!accessToken) return;

        const mimeType = Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";
        const url = await uploadFile(
          uri,
          `voice_${Date.now()}.m4a`,
          mimeType,
          accessToken,
        );

        await chatService.sendMessage(convId, {
          type: "voice",
          content: {
            mediaUrl: url,
            duration: Math.max(1, Math.round(durationMillis / 1000)),
          },
          replyTo: replyToMessageId || undefined,
        });
        setReplyToMessageId(null);
      } catch (error) {
        console.error("Không thể gửi voice:", error);
        GrayToast("Không thể gửi voice");
      } finally {
        setIsSending(false);
        setVoiceRecordingSeconds(0);
      }
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        GrayToast("Cần cấp quyền micro");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await recording.startAsync();

      voiceRecordingRef.current = recording;
      setVoiceRecordingSeconds(0);
      setIsRecordingVoice(true);

      if (voiceRecordingTimerRef.current) {
        clearInterval(voiceRecordingTimerRef.current);
      }
      voiceRecordingTimerRef.current = setInterval(() => {
        setVoiceRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Không thể bật voice:", error);
      voiceRecordingRef.current = null;
      setIsRecordingVoice(false);
      setVoiceRecordingSeconds(0);
      if (voiceRecordingTimerRef.current) {
        clearInterval(voiceRecordingTimerRef.current);
        voiceRecordingTimerRef.current = null;
      }
      GrayToast("Không thể bật voice");
    }
  }, [convId, isRecordingVoice, isSending, replyToMessageId, voiceRecordingSeconds]);

  const handleCancelVoiceRecording = useCallback(async () => {
    if (!isRecordingVoice) return;

    const recording = voiceRecordingRef.current;
    voiceRecordingRef.current = null;
    setIsRecordingVoice(false);
    setVoiceRecordingSeconds(0);

    if (voiceRecordingTimerRef.current) {
      clearInterval(voiceRecordingTimerRef.current);
      voiceRecordingTimerRef.current = null;
    }

    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch (error) {
      console.error("Lỗi khi hủy voice:", error);
    }
  }, [isRecordingVoice]);

  const handleLongPress = (msg: Message) => {
    const isMe = msg.senderId === user?.id;
    const isPinnedMessage = Boolean(
      pinnedMessage && String(pinnedMessage.messageId) === String(msg.id),
    );
    setSelectedMsg(msg);

    const opts: any[] = [
      { text: "Tha cam xuc", onPress: () => setShowReactions(true) },
    ];

    if (isMe && !msg.isDeleted) {
      opts.push({
        text: "Thu hoi tin nhan",
        style: "destructive",
        onPress: () => {
          socketService.emit("chat:recall", {
            conversationId: convId,
            messageId: msg.id,
            senderId: user?.id,
          });
          chatService.deleteMessage(convId, msg.id);
        },
      });
    }

    if (!msg.isDeleted && canPinInGroup) {
      opts.push({
        text: isPinnedMessage ? "Bo ghim tin nhan" : "Ghim tin nhan",
        onPress: () => {
          if (isPinnedMessage) {
            void handleUnpinMessage();
            return;
          }
          void handlePinMessage(msg);
        },
      });
    }

    if (!msg.isDeleted) {
      opts.push({
        text: "Tra loi",
        onPress: () => setReplyToMessageId(msg.id),
      });
      opts.push({
        text: "Chuyen tiep",
        onPress: () => setForwardMessage(msg),
      });
    }

    opts.push({ text: "Huy", style: "cancel" });
    Alert.alert("Tuy chon", undefined, opts);
  };

  const handleReact = async (emoji: string) => {
    setShowReactions(false);
    if (!selectedMsg) return;
    await chatService.addReaction(convId, selectedMsg.id, emoji);
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.id;
    const replyPreview = resolveReplyPreview((item as any).replyTo, convMessages);
    const reactions = (item.reactions || []).reduce<Record<string, number>>(
      (acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
      },
      {},
    );

    return (
      <TouchableOpacity
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
        style={{
          flexDirection: "row",
          justifyContent: isMe ? "flex-end" : "flex-start",
          marginHorizontal: 12,
          marginVertical: 3,
        }}
      >
        {!isMe && <Avatar name={item.senderName || "?"} size={32} />}
        <View style={{ maxWidth: "72%", marginLeft: isMe ? 0 : 8 }}>
          {!isMe && (
            <Text
              style={{
                fontSize: 11,
                color: "#6B7280",
                marginBottom: 2,
                marginLeft: 4,
              }}
            >
              {item.senderName}
            </Text>
          )}
          <View
            style={{
              backgroundColor: isMe ? "#0068FF" : "#F3F4F6",
              borderRadius: 18,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            {replyPreview && !item.isDeleted && (
              <View
                style={{
                  marginBottom: 8,
                  paddingHorizontal: 11,
                  paddingVertical: 9,
                  borderRadius: 14,
                  backgroundColor: isMe ? "#EAF2FF" : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: isMe ? "#9DBDFF" : "#D8E6FF",
                }}
              >
                <Text
                  style={{
                    color: "#2563EB",
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {replyPreview.senderName}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    marginTop: 3,
                    color: "#64748B",
                    fontSize: 12,
                    lineHeight: 17,
                  }}
                >
                  {replyPreview.content}
                </Text>
              </View>
            )}
            {item.isDeleted ? (
              <Text
                style={{
                  color: isMe ? "#cce4ff" : "#9CA3AF",
                  fontStyle: "italic",
                }}
              >
                Tin nhắn đã thu hồi
              </Text>
            ) : item.type === "sticker" ? (
              <Image
                source={{ uri: String(item.content || "") }}
                style={{ width: 100, height: 100 }}
                resizeMode="contain"
              />
            ) : item.type === "voice" ? (
              <VoiceMessagePlayer
                audioUrl={
                  getFullMediaUrl(
                    typeof item.content === "object"
                      ? (item.content as any).mediaUrl || (item.content as any).url
                      : String(item.content || "")
                  ) || ""
                }
                durationSeconds={
                  typeof item.content === "object"
                    ? (item.content as any).duration || 0
                    : 0
                }
                textColor={isMe ? "#fff" : "#111827"}
              />
            ) : (
              <Text
                style={{ color: isMe ? "#fff" : "#111827", lineHeight: 20 }}
              >
                {typeof item.content === "string"
                  ? item.content
                  : String((item.content as any)?.text || "")}
              </Text>
            )}
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: isMe ? "flex-end" : "flex-start",
              alignItems: "center",
              gap: 4,
              marginTop: 2,
            }}
          >
            <Text style={{ fontSize: 10, color: "#9CA3AF" }}>
              {formatTime(item.createdAt)}
            </Text>
            {Object.entries(reactions).map(([e, c]) => (
              <Text key={e} style={{ fontSize: 11 }}>
                {e}
                {c > 1 ? c : ""}
              </Text>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!convId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Khong tim thay cuoc tro chuyen</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: "#fff",
          paddingTop: headerTopPadding,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 4, marginRight: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <Avatar
            uri={conversation?.avatar || group?.avatar}
            name={conversation?.name || group?.name || "Nhóm"}
            size={40}
          />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}
            >
              {conversation?.name || group?.name || "Nhóm"}
            </Text>
            <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>
              {group?.membersCount || group?.members?.length || conversation?.participants?.length || 0} thành viên
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={{ padding: 6 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="people-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ padding: 6 }}
          onPress={() => setShowChatOptions(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <View
        style={{
          flex: 1,
          position: "relative",
          backgroundColor: chatAreaBackgroundColor,
          overflow: "hidden",
        }}
      >
        {usesImageBackground && (
          <ImageBackground
            source={{ uri: conversationBackground }}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
            imageStyle={{ resizeMode: "cover" }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.72)",
              }}
            />
          </ImageBackground>
        )}
      {pinnedMessage && (
        <View
          style={{
            backgroundColor: "#FFFBEB",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#FDE68A",
            paddingHorizontal: 16,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            zIndex: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1, gap: 10 }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2 }}>
              <Line x1="12" x2="12" y1="17" y2="22" />
              <Path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
            </Svg>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#D97706",
                  fontSize: 13,
                  fontWeight: "700",
                  marginBottom: 2,
                }}
              >
                Tin nhắn đã ghim
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: "#D97706", fontSize: 13 }}
              >
                {getPinnedMessagePreview(pinnedMessage)}
              </Text>
            </View>
          </View>

          {canPinInGroup && (
            <TouchableOpacity
              onPress={() => void handleUnpinMessage()}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: "#FEF3C7",
              }}
            >
              <Text
                style={{ color: "#D97706", fontSize: 13, fontWeight: "500" }}
              >
                Bỏ ghim
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#0068FF" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={convMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 10, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 80 }}>
              <Text style={{ fontSize: 36 }}>💬</Text>
              <Text style={{ color: "#9CA3AF", marginTop: 8 }}>
                Không có tin nhắn
              </Text>
            </View>
          }
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />
      )}
      </View>

      {/* Reaction picker */}
      {showReactions && (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#fff",
            borderRadius: 24,
            marginHorizontal: 16,
            marginBottom: 8,
            padding: 8,
            gap: 8,
            elevation: 4,
          }}
        >
          {REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleReact(emoji)}
              style={{ padding: 4 }}
            >
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setShowReactions(false)}
            style={{ padding: 4 }}
          >
            <Ionicons name="close-circle-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      <ForwardMessageModal
        visible={Boolean(forwardMessage)}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
      />
      {conversation && (
        <ChatOptionsModal
          visible={showChatOptions}
          onClose={() => setShowChatOptions(false)}
          conversation={conversation}
        />
      )}

      {/* Input */}
      <View
        style={{
          backgroundColor: "#fff",
          paddingHorizontal: 8,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          borderTopWidth: 1,
          borderTopColor: "#F3F4F6",
        }}
      >
        {activeReplyPreview && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 8,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 14,
              backgroundColor: "#EFF6FF",
              borderWidth: 1,
              borderColor: "#BFDBFE",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Ionicons
                name="return-up-back-outline"
                size={18}
                color="#2563EB"
              />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text
                  style={{ color: "#2563EB", fontSize: 12, fontWeight: "700" }}
                >
                  Trả lời {activeReplyPreview.senderName}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ marginTop: 2, color: "#475569", fontSize: 12 }}
                >
                  {activeReplyPreview.content}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setReplyToMessageId(null)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#DBEAFE",
              }}
            >
              <Ionicons name="close" size={16} color="#2563EB" />
            </TouchableOpacity>
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#ECEDEF",
            borderRadius: 26,
            minHeight: 50,
            paddingLeft: 6,
            paddingRight: 8,
          }}
        >
          <TouchableOpacity
            onPress={handleToggleStickerPicker}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="happy-outline" size={28} color="#7B8088" />
          </TouchableOpacity>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Tin nhắn"
            placeholderTextColor="#8A8F98"
            multiline
            style={{
              flex: 1,
              marginLeft: 4,
              marginRight: 8,
              fontSize: 17,
              color: "#343A40",
              maxHeight: 110,
              paddingVertical: 8,
            }}
          />

          <TouchableOpacity
            onPress={handlePickFile}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={23} color="#7B8088" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={
              text.trim()
                ? handleSend
                : handleToggleVoiceRecording
            }
            disabled={isSending}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#7B8088" />
            ) : (
              <Ionicons
                name={text.trim() ? "send" : isRecordingVoice ? "send" : "mic-outline"}
                size={24}
                color={text.trim() || isRecordingVoice ? "#0068FF" : "#7B8088"}
              />
            )}
          </TouchableOpacity>

          {isRecordingVoice && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "#ECEDEF",
                borderRadius: 26,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                zIndex: 10,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#EF4444",
                  marginRight: 8,
                }}
              />
              <Text style={{ flex: 1, fontSize: 16, color: "#EF4444", fontWeight: "600" }}>
                Đang ghi âm {formatRecordingTime(voiceRecordingSeconds)}
              </Text>
              
              <TouchableOpacity
                onPress={handleCancelVoiceRecording}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 4,
                }}
              >
                <Ionicons name="trash-outline" size={22} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleToggleVoiceRecording}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="send" size={24} color="#0068FF" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={handlePickImage}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="image-outline" size={24} color="#7B8088" />
          </TouchableOpacity>
        </View>

        {showStickerPicker && (
          <View
            style={{
              marginTop: 8,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              backgroundColor: "#F8FAFC",
              paddingVertical: 8,
              paddingHorizontal: 6,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 2 }}
            >
              {STICKER_URLS.map((url, index) => (
                <TouchableOpacity
                  key={`${url}-${index}`}
                  onPress={() => void handleSendSticker(url)}
                  disabled={isSending}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    marginRight: index === STICKER_URLS.length - 1 ? 0 : 8,
                    opacity: isSending ? 0.7 : 1,
                  }}
                >
                  <Image
                    source={{ uri: url }}
                    style={{ width: 50, height: 50 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
