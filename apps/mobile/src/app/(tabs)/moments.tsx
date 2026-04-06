import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CenterLoading, GrayToast } from "@/components/ui";
import { Colors } from "@/constants/colors";
import { momentService } from "@/services";
import type {
  Moment,
  MomentAuthor,
  MomentComment,
  MomentProfile,
} from "@/types";
import { useAuthStore } from "@/stores";

type FeedMode = "friends" | "me" | "reacted";

type ComposerMedia = {
  uri: string;
  name?: string;
  mimeType?: string | null;
  mediaType: "image" | "video";
};

const FEED_OPTIONS: Array<{
  key: FeedMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    key: "friends",
    label: "\u0042\u1ea1n \u0062\u00e8",
    icon: "people-outline",
  },
  { key: "me", label: "\u0043\u1ee7a t\u00f4i", icon: "person-outline" },
  {
    key: "reacted",
    label: "\u0110\u00e3 th\u1ea3 c\u1ea3m x\u00fac",
    icon: "heart-outline",
  },
];

const REACTION_OPTIONS = [
  { key: "like", label: "\u0054h\u00edch", icon: "\uD83D\uDC4D" },
  { key: "love", label: "Y\u00eau th\u00edch", icon: "\u2764\uFE0F" },
  { key: "haha", label: "Haha", icon: "\uD83D\uDE02" },
  { key: "wow", label: "Wow", icon: "\uD83D\uDE2E" },
  { key: "sad", label: "Bu\u1ed3n", icon: "\uD83D\uDE22" },
  { key: "angry", label: "Gi\u1eadn d\u1eef", icon: "\uD83D\uDE21" },
];

const getReactionOption = (reactionKey?: string | null) =>
  REACTION_OPTIONS.find((option) => option.key === reactionKey) || null;

const summarizeCommentReactions = (
  reactions: MomentComment["reactions"] = [],
) => {
  const summary = reactions.reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(summary).map(([emoji, count]) => ({
    emoji: getReactionOption(emoji)?.icon || emoji,
    count,
  }));
};

const getDisplayName = (
  author?: MomentAuthor | null,
  fallback = "Ng\u01b0\u1eddi d\u00f9ng",
) => author?.userName || fallback;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const isVideoMimeType = (mimeType?: string | null) =>
  typeof mimeType === "string" && mimeType.startsWith("video/");

const isVideoUrl = (url?: string | null) => {
  const normalizedUrl = String(url || "").split("?")[0].toLowerCase();
  return [".mp4", ".mov", ".webm", ".m4v"].some((extension) =>
    normalizedUrl.endsWith(extension),
  );
};

const getFileExtensionFromAsset = (asset: ImagePicker.ImagePickerAsset) => {
  const normalizedUri = String(asset.uri || "").split("?")[0].toLowerCase();

  if (normalizedUri.endsWith(".png")) return "png";
  if (normalizedUri.endsWith(".gif")) return "gif";
  if (normalizedUri.endsWith(".webp")) return "webp";
  if (normalizedUri.endsWith(".heic")) return "heic";
  if (normalizedUri.endsWith(".heif")) return "heif";
  if (normalizedUri.endsWith(".mov")) return "mov";
  if (normalizedUri.endsWith(".webm")) return "webm";
  if (normalizedUri.endsWith(".mp4")) return "mp4";

  return asset.type === "video" ? "mp4" : "jpg";
};

const mapAssetToComposerMedia = (
  asset: ImagePicker.ImagePickerAsset,
  index: number,
): ComposerMedia => {
  const mediaType = asset.type === "video" ? "video" : "image";
  const extension = getFileExtensionFromAsset(asset);

  return {
    uri: asset.uri,
    name: asset.fileName || `moment-${Date.now()}-${index}.${extension}`,
    mimeType:
      asset.mimeType ||
      (mediaType === "video" ? "video/mp4" : "image/jpeg"),
    mediaType,
  };
};

const getAvatarFallback = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const formatRelativeTime = (value?: string) => {
  if (!value) return "";

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}p`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d`;
  }

  return date.toLocaleDateString();
};

function AvatarBubble({
  name,
  uri,
  size = 44,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      className="items-center justify-center rounded-full bg-[#DCEBFF]"
      style={{ width: size, height: size }}
    >
      <Text
        className="font-bold text-[#0068FF]"
        style={{ fontSize: Math.max(12, size * 0.32) }}
      >
        {getAvatarFallback(name)}
      </Text>
    </View>
  );
}

function SectionChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      className={`mr-3 flex-row items-center rounded-full px-4 py-2 ${
        active ? "bg-[#0068FF]" : "bg-white"
      }`}
      style={{
        borderWidth: active ? 0 : 1,
        borderColor: "#E5E7EB",
      }}
    >
      <Ionicons name={icon} size={16} color={active ? "white" : "#6B7280"} />
      <Text
        className={`ml-2 text-sm font-semibold ${
          active ? "text-white" : "text-gray-700"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function MomentsScreen() {
  const insets = useSafeAreaInsets();
  const commentListRef = useRef<FlatList<MomentComment>>(null);
  const commentInputRef = useRef<TextInput>(null);
  const { user } = useAuthStore();
  const [activeFeed, setActiveFeed] = useState<FeedMode>("friends");
  const [moments, setMoments] = useState<Moment[]>([]);
  const [profile, setProfile] = useState<MomentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [composerMedia, setComposerMedia] = useState<ComposerMedia[]>([]);
  const [reactionPickerMomentId, setReactionPickerMomentId] = useState<
    string | null
  >(null);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentTarget, setCommentTarget] = useState<Moment | null>(null);
  const [comments, setComments] = useState<MomentComment[]>([]);
  const [commentReplyTarget, setCommentReplyTarget] =
    useState<MomentComment | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isCommentLoading, setIsCommentLoading] = useState(false);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [actionMomentId, setActionMomentId] = useState<string | null>(null);

  const canPost = useMemo(
    () => Boolean(composerText.trim() || composerMedia.length > 0) && !isPosting,
    [composerMedia.length, composerText, isPosting],
  );

  const reactionTarget = useMemo(
    () =>
      moments.find((moment) => moment.momentId === reactionPickerMomentId) ||
      null,
    [moments, reactionPickerMomentId],
  );

  const scrollCommentsToEnd = useCallback((animated = true) => {
    setTimeout(() => {
      commentListRef.current?.scrollToEnd({ animated });
    }, 150);
  }, []);

  const loadFeed = useCallback(async (mode: FeedMode, showSpinner = true) => {
    try {
      if (showSpinner) {
        setIsLoading(true);
      }

      if (mode === "friends") {
        const data = await momentService.getFriendMoments();
        setMoments(data);
        setProfile(null);
        return;
      }

      if (mode === "me") {
        const data = await momentService.getMyProfile();
        setProfile(data);
        setMoments(data.moments);
        return;
      }

      const reacted = await momentService.getReactedMoments();
      setMoments(reacted);
      setProfile(null);
    } catch (error) {
      console.error("Load moments error:", error);
      GrayToast(getErrorMessage(error, "Không thể tải khoảnh khắc"));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFeed(activeFeed);
    }, [activeFeed, loadFeed]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadFeed(activeFeed, false);
  };

  const handlePickMedia = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Cấp quyền truy cập ảnh",
          "Hãy cấp quyền truy cập ảnh để tải khoảnh khắc",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        orderedSelection: true,
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const pickedMedia = result.assets.map(mapAssetToComposerMedia);
      setComposerMedia((prev) => {
        const merged = [...prev, ...pickedMedia];
        const deduped = merged.filter(
          (item, index, list) =>
            list.findIndex((candidate) => candidate.uri === item.uri) === index,
        );

        return deduped.slice(0, 10);
      });
    } catch (error) {
      console.error("Pick moment media error:", error);
      GrayToast("Không thể chọn ảnh hoặc video");
    }
  };

  const handleRemoveComposerMedia = (uri: string) => {
    setComposerMedia((prev) => prev.filter((item) => item.uri !== uri));
  };

  const handleCreateMoment = async () => {
    if (!canPost) {
      return;
    }

    try {
      setIsPosting(true);

      await momentService.createMoment({
        content: composerText.trim(),
        mediaFiles: composerMedia,
      });

      setComposerText("");
      setComposerMedia([]);
      GrayToast("Đăng khoảnh khắc thành công");

      const nextFeed = activeFeed === "reacted" ? "me" : activeFeed;
      if (nextFeed !== activeFeed) {
        setActiveFeed(nextFeed);
      }
      await loadFeed(nextFeed, false);
    } catch (error) {
      console.error("Create moment error:", error);
      GrayToast(getErrorMessage(error, "Đăng khoảnh khắc thất bại"));
    } finally {
      setIsPosting(false);
    }
  };

  const closeReactionPicker = () => setReactionPickerMomentId(null);

  const openReactionPicker = (momentId: string) => {
    setReactionPickerMomentId(momentId);
  };

  const handleReactionSelect = async (
    momentId: string,
    reactionKey: string,
  ) => {
    try {
      closeReactionPicker();
      setActionMomentId(momentId);
      await momentService.reactToMoment(momentId, reactionKey);
      await loadFeed(activeFeed, false);
    } catch (error) {
      GrayToast(getErrorMessage(error, "Không thể thả cảm xúc"));
    } finally {
      setActionMomentId(null);
    }
  };

  const openComments = async (moment: Moment) => {
    try {
      setCommentTarget(moment);
      setCommentsVisible(true);
      setCommentReplyTarget(null);
      setCommentText("");
      setIsCommentLoading(true);
      const data = await momentService.getMomentComments(moment.momentId);
      setComments(data);
      if (data.length > 0) {
        scrollCommentsToEnd(false);
      }
    } catch (error) {
      GrayToast(getErrorMessage(error, "Không thể tải bình luận"));
    } finally {
      setIsCommentLoading(false);
    }
  };

  const closeComments = () => {
    setCommentsVisible(false);
    setCommentTarget(null);
    setComments([]);
    setCommentText("");
    setCommentReplyTarget(null);
  };

  const handleReplyToComment = (comment: MomentComment) => {
    setCommentReplyTarget(comment);
    scrollCommentsToEnd(false);
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 100);
  };

  const handleCommentReaction = async (
    comment: MomentComment,
    reactionKey: string,
  ) => {
    if (!commentTarget) {
      return;
    }

    try {
      const updated = await momentService.reactToComment(
        commentTarget.momentId,
        comment.commentId,
        reactionKey,
      );
      setComments((prev) =>
        prev.map((item) =>
          item.commentId === updated.commentId ? updated : item,
        ),
      );
    } catch (error) {
      GrayToast(getErrorMessage(error, "Không thể thả cảm xúc"));
    }
  };

  const openCommentReactionPicker = (comment: MomentComment) => {
    Alert.alert(
      "Thả cảm xúc",
      "Chọn cảm xúc cho bình luận này",

      [
        ...REACTION_OPTIONS.map((option) => ({
          text: option.icon,
          onPress: () => handleCommentReaction(comment, option.key),
        })),
        { text: "Đóng", style: "cancel" as const },
      ],
    );
  };

  const handleCommentSubmit = async () => {
    if (!commentTarget || !commentText.trim() || isCommentSubmitting) {
      return;
    }

    try {
      setIsCommentSubmitting(true);
      const created = await momentService.replyToComment(
        commentTarget.momentId,
        commentText.trim(),
        commentReplyTarget?.commentId || null,
      );
      setComments((prev) => [...prev, created]);
      setCommentText("");
      setCommentReplyTarget(null);
      scrollCommentsToEnd();
      await loadFeed(activeFeed, false);
    } catch (error) {
      GrayToast(getErrorMessage(error, "Không thể gửi bình luận"));
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  const handleShareMoment = (moment: Moment) => {
    Alert.alert("Chia sẻ", "Bạn muốn chia sẻ khoảnh khắc này ?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Chia sẻ",
        onPress: async () => {
          try {
            setActionMomentId(moment.momentId);
            await momentService.shareMoment(moment.momentId, "");
            GrayToast("Đã chia sẻ khoảnh khắc");
            await loadFeed(activeFeed, false);
          } catch (error) {
            GrayToast(getErrorMessage(error, "Không thể chia sẻ"));
          } finally {
            setActionMomentId(null);
          }
        },
      },
    ]);
  };

  const handleDeleteMoment = (moment: Moment) => {
    Alert.alert("Xóa khoảnh khắc", "Khoảnh khắc này sẽ bị xóa vĩnh viễn.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            setActionMomentId(moment.momentId);
            await momentService.deleteMoment(moment.momentId);
            GrayToast("Đã xóa khoảnh khắc");
            await loadFeed(activeFeed, false);
          } catch (error) {
            GrayToast(getErrorMessage(error, "Không thể xóa khoảnh khắc"));
          } finally {
            setActionMomentId(null);
          }
        },
      },
    ]);
  };

  const renderMomentCard = ({ item }: { item: Moment }) => {
    const authorName = getDisplayName(
      item.author,
      item.isOwner ? user?.fullName || "Bạn" : `Người dùng ${item.authorId}`,
    );
    const activeReaction = getReactionOption(item.currentUserReaction);

    return (
      <View className="mb-4 rounded-[24px] bg-white px-4 py-4">
        <View className="flex-row items-start">
          <AvatarBubble
            name={authorName}
            uri={
              item.author?.avartarUrl || (item.isOwner ? user?.avatarUrl : null)
            }
          />

          <View className="ml-3 flex-1">
            <View className="flex-row items-center justify-between">
              <View className="pr-3">
                <Text className="text-base font-bold text-gray-900">
                  {authorName}
                </Text>
                <Text className="mt-1 text-xs text-gray-500">
                  {formatRelativeTime(item.createdAt)}
                </Text>
              </View>

              {item.isOwner ? (
                <TouchableOpacity
                  disabled={actionMomentId === item.momentId}
                  onPress={() => handleDeleteMoment(item)}
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#F4F6FB]"
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              ) : null}
            </View>

            {item.content ? (
              <Text className="mt-3 text-[15px] leading-6 text-gray-800">
                {item.content}
              </Text>
            ) : null}

            {item.mediaUrls.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-3"
              >
                {item.mediaUrls.map((url, index) =>
                  isVideoUrl(url) ? (
                    <Video
                      key={`${url}-${index}`}
                      source={{ uri: url }}
                      style={{
                        width: 288,
                        height: 192,
                        borderRadius: 20,
                        backgroundColor: "#000000",
                        marginRight: 12,
                      }}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                      isLooping={false}
                      useNativeControls
                    />
                  ) : (
                    <Image
                      key={`${url}-${index}`}
                      source={{ uri: url }}
                      className="mr-3 h-48 w-72 rounded-[20px] bg-[#E5E7EB]"
                      resizeMode="cover"
                    />
                  ),
                )}
              </ScrollView>
            ) : null}

            {item.type === "share" && item.originalMomentSnapshot ? (
              <View className="mt-3 rounded-[20px] border border-[#DCE7FF] bg-[#F8FBFF] px-3 py-3">
                <Text className="text-sm font-semibold text-[#0068FF]">
                  Chia sẻ từ{" "}
                  {getDisplayName(item.originalMomentSnapshot.author, "Bạn bè")}
                </Text>
                {item.originalMomentSnapshot.content ? (
                  <Text className="mt-2 text-sm leading-5 text-gray-700">
                    {item.originalMomentSnapshot.content}
                  </Text>
                ) : null}
                {item.originalMomentSnapshot.mediaUrls?.[0] ? (
                  isVideoUrl(item.originalMomentSnapshot.mediaUrls[0]) ? (
                    <Video
                      source={{ uri: item.originalMomentSnapshot.mediaUrls[0] }}
                      style={{
                        width: "100%",
                        height: 160,
                        borderRadius: 18,
                        backgroundColor: "#000000",
                        marginTop: 12,
                      }}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                      isLooping={false}
                      useNativeControls
                    />
                  ) : (
                    <Image
                      source={{ uri: item.originalMomentSnapshot.mediaUrls[0] }}
                      className="mt-3 h-40 w-full rounded-[18px] bg-[#E5E7EB]"
                      resizeMode="cover"
                    />
                  )
                ) : null}
              </View>
            ) : null}

            <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-[#F7F9FC] px-3 py-2">
              <Text className="text-xs font-medium text-gray-500">
                {`${item.reactionCount} cảm xúc`}
              </Text>
              <Text className="text-xs font-medium text-gray-500">
                {`${item.commentCount} bình luận`}
              </Text>
              <Text className="text-xs font-medium text-gray-500">
                {`${item.shareCount} chia sẻ`}
              </Text>
            </View>

            <View className="mt-3 flex-row">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openReactionPicker(item.momentId)}
                className={`mr-2 flex-1 flex-row items-center justify-center rounded-2xl px-3 py-3 ${
                  item.currentUserReaction ? "bg-[#E8F0FF]" : "bg-[#F4F6FB]"
                }`}
              >
                {activeReaction ? (
                  <Text className="text-lg">{activeReaction.icon}</Text>
                ) : (
                  <Ionicons name="heart-outline" size={18} color="#6B7280" />
                )}
                <Text
                  className={`ml-2 text-sm font-semibold ${
                    item.currentUserReaction
                      ? "text-[#0068FF]"
                      : "text-gray-600"
                  }`}
                >
                  {activeReaction?.icon || "Cảm xúc"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openComments(item)}
                className="mr-2 flex-1 flex-row items-center justify-center rounded-2xl bg-[#F4F6FB] px-3 py-3"
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={18}
                  color="#6B7280"
                />
                <Text className="ml-2 text-sm font-semibold text-gray-600">
                  Bình luận
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleShareMoment(item)}
                className="flex-1 flex-row items-center justify-center rounded-2xl bg-[#F4F6FB] px-3 py-3"
              >
                <Ionicons name="repeat-outline" size={18} color="#6B7280" />
                <Text className="ml-2 text-sm font-semibold text-gray-600">
                  Chia sẻ
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const headerComponent = (
    <View className="px-4 pb-4 pt-4">
      <View className="rounded-[28px] bg-white px-4 py-4">
        <View className="flex-row items-center">
          <AvatarBubble
            name={user?.fullName || "Bạn"}
            uri={user?.avatarUrl}
            size={48}
          />

          <View className="ml-3 flex-1">
            <Text className="text-sm font-semibold text-gray-900">
              Đăng khoảnh khắc mới
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              Chia sẻ cảm xúc, hình ảnh và cập nhật nhanh với bạn bè.
            </Text>
          </View>
        </View>

        <TextInput
          value={composerText}
          onChangeText={setComposerText}
          placeholder="Hôm nay của bạn có gì mới?"
          placeholderTextColor="#9CA3AF"
          multiline
          className="mt-4 min-h-[96px] rounded-[22px] bg-[#F6F8FC] px-4 py-4 text-[15px] text-gray-900"
          textAlignVertical="top"
        />

        {composerMedia.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
          >
            {composerMedia.map((media, index) => (
              <View key={`${media.uri}-${index}`} className="mr-3">
                {media.mediaType === "video" || isVideoMimeType(media.mimeType) ? (
                  <Video
                    source={{ uri: media.uri }}
                    style={{
                      width: 288,
                      height: 192,
                      borderRadius: 22,
                      backgroundColor: "#000000",
                    }}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isLooping={false}
                    useNativeControls
                  />
                ) : (
                  <Image
                    source={{ uri: media.uri }}
                    className="h-48 w-72 rounded-[22px]"
                    resizeMode="cover"
                  />
                )}

                <TouchableOpacity
                  onPress={() => handleRemoveComposerMedia(media.uri)}
                  className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-black/60"
                >
                  <Ionicons name="close" size={18} color="white" />
                </TouchableOpacity>

                <View className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1">
                  <Text className="text-xs font-semibold text-white">
                    {media.mediaType === "video" ? "Video" : "Ảnh"}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View className="mt-4 flex-row items-center">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePickMedia}
            className="mr-3 flex-row items-center rounded-full bg-[#E8F0FF] px-4 py-3"
          >
            <Ionicons name="image-outline" size={18} color={Colors.primary} />
            <Text className="ml-2 text-sm font-semibold text-[#0068FF]">
              {composerMedia.length > 0 ? "Thêm ảnh/video" : "Chọn ảnh/video"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!canPost}
            onPress={handleCreateMoment}
            className={`flex-1 items-center rounded-full px-4 py-3 ${
              canPost ? "bg-[#0068FF]" : "bg-[#BFD5FF]"
            }`}
          >
            <Text className="text-sm font-bold text-white">
              {isPosting ? "Đang tải..." : "Đăng khoảnh khắc"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="mt-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FEED_OPTIONS.map((option) => (
            <SectionChip
              key={option.key}
              label={option.label}
              icon={option.icon}
              active={activeFeed === option.key}
              onPress={() => setActiveFeed(option.key)}
            />
          ))}
        </ScrollView>
      </View>

      {activeFeed === "me" && profile?.user ? (
        <View className="mt-4 rounded-[24px] bg-[#0A6BFF] px-4 py-4">
          <View className="flex-row items-center">
            <AvatarBubble
              name={profile.user.userName}
              uri={profile.user.avartarUrl}
              size={54}
            />
            <View className="ml-3 flex-1">
              <Text className="text-lg font-bold text-white">
                {profile.user.userName}
              </Text>
              <Text className="mt-1 text-sm text-white/80">
                {`${moments.length} khoảnh khắc đã đăng`}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderEmptyState = () => {
    const messages: Record<FeedMode, { title: string; description: string }> = {
      friends: {
        title: "Chưa có khoảnh khắc từ bạn bè",
        description:
          "Khi bạn bè đăng bài mới, feed này sẽ cập nhật ngay tại đây.",
      },
      me: {
        title: "Bạn chưa đăng khoảnh khắc nào",
        description: "Hãy đăng bài đầu tiên để bắt đầu trang cá nhân của bạn.",
      },
      reacted: {
        title: "Chưa có khoảnh khắc đã thả cảm xúc",
        description:
          "Những bài bạn đã react sẽ được lưu lại để xem nhanh ở đây.",
      },
    };

    return (
      <View className="mx-4 mt-2 items-center rounded-[28px] bg-white px-6 py-12">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#E8F0FF]">
          <Ionicons name="sparkles-outline" size={28} color={Colors.primary} />
        </View>
        <Text className="text-center text-base font-bold text-gray-900">
          {messages[activeFeed].title}
        </Text>
        <Text className="mt-2 text-center text-sm leading-6 text-gray-500">
          {messages[activeFeed].description}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#F3F7FD]">
      <CenterLoading visible={isLoading && moments.length === 0} />

      <FlatList
        data={moments}
        keyExtractor={(item) => item.momentId}
        renderItem={renderMomentCard}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={Boolean(reactionPickerMomentId)}
        transparent
        animationType="fade"
        onRequestClose={closeReactionPicker}
      >
        <Pressable
          className="flex-1 justify-end bg-black/35"
          onPress={closeReactionPicker}
        >
          <Pressable
            className="rounded-t-[32px] bg-white px-5 pb-8 pt-4"
            onPress={() => {}}
          >
            <View className="mb-4 self-center h-1.5 w-12 rounded-full bg-[#D1D5DB]" />
            <Text className="text-center text-lg font-bold text-gray-900">
              Thả cảm xúc
            </Text>
            <Text className="mt-2 text-center text-sm leading-6 text-gray-500">
              Chọn 1 biểu tượng để react nhanh cho khoảnh khắc này.
            </Text>

            <View className="mt-5 flex-row flex-wrap justify-between">
              {REACTION_OPTIONS.map((option) => {
                const isActive =
                  reactionTarget?.currentUserReaction === option.key;

                return (
                  <TouchableOpacity
                    key={option.key}
                    activeOpacity={0.85}
                    disabled={!reactionPickerMomentId}
                    onPress={() =>
                      reactionPickerMomentId &&
                      handleReactionSelect(reactionPickerMomentId, option.key)
                    }
                    className={`mb-3 w-[31%] items-center rounded-[24px] px-3 py-4 ${
                      isActive ? "bg-[#E8F0FF]" : "bg-[#F4F6FB]"
                    }`}
                    style={{
                      borderWidth: isActive ? 1.5 : 1,
                      borderColor: isActive ? "#0068FF" : "#E5E7EB",
                    }}
                  >
                    <Text className="text-[30px]">{option.icon}</Text>
                    <Text
                      className={`mt-2 text-sm font-semibold ${
                        isActive ? "text-[#0068FF]" : "text-gray-700"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="mt-2 flex-row">
              {reactionTarget?.currentUserReaction ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    handleReactionSelect(
                      reactionTarget.momentId,
                      reactionTarget.currentUserReaction as string,
                    )
                  }
                  className="mr-3 flex-1 items-center rounded-full bg-[#FFF1F2] px-4 py-3"
                >
                  <Text className="text-sm font-semibold text-[#E11D48]">
                    Bỏ cảm xúc
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={closeReactionPicker}
                className={`items-center rounded-full bg-[#F4F6FB] px-4 py-3 ${
                  reactionTarget?.currentUserReaction ? "flex-1" : "w-full"
                }`}
              >
                <Text className="text-sm font-semibold text-gray-700">
                  Đóng
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={commentsVisible}
        animationType="slide"
        onRequestClose={closeComments}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-[#F7F9FC]"
        >
          <View className="flex-1 bg-[#F7F9FC]">
            <View
              className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-4"
              style={{ paddingTop: insets.top + 12 }}
            >
              <TouchableOpacity onPress={closeComments}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
              <Text className="text-base font-bold text-gray-900">
                Bình luận
              </Text>
              <View className="w-6" />
            </View>

            {commentTarget ? (
              <View className="border-b border-gray-200 bg-white px-4 py-3">
                <Text className="text-sm font-semibold text-gray-900">
                  {getDisplayName(commentTarget.author, "T\u00e1c gi\u1ea3")}
                </Text>
                {commentTarget.content ? (
                  <Text className="mt-1 text-sm leading-6 text-gray-600">
                    {commentTarget.content}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {isCommentLoading ? (
              <View className="flex-1 items-center justify-center">
                <Text className="text-sm text-gray-500">
                  Đang tải bình luận...
                </Text>
              </View>
            ) : (
              <FlatList
                ref={commentListRef}
                data={comments}
                keyExtractor={(item) => item.commentId}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                renderItem={({ item }) => {
                  const activeCommentReaction = getReactionOption(
                    item.currentUserReaction,
                  );
                  const reactionSummary = summarizeCommentReactions(
                    item.reactions,
                  );

                  return (
                    <View
                      className={`mb-3 rounded-[20px] bg-white px-4 py-3 ${
                        item.replyTo ? "ml-6 border border-[#E5EEFF]" : ""
                      }`}
                    >
                      <View className="flex-row items-start">
                        <AvatarBubble
                          name={getDisplayName(
                            item.author,
                            `Người dùng ${item.userId}`,
                          )}
                          uri={item.author?.avartarUrl}
                          size={38}
                        />
                        <View className="ml-3 flex-1">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-sm font-bold text-gray-900">
                              {getDisplayName(
                                item.author,
                                `Người dùng ${item.userId}`,
                              )}
                            </Text>
                            <Text className="text-xs text-gray-500">
                              {formatRelativeTime(item.createdAt)}
                            </Text>
                          </View>

                          {item.replyTo ? (
                            <View className="mt-2 rounded-2xl border border-[#DCE7FF] bg-[#F8FBFF] px-3 py-2">
                              <Text className="text-xs font-semibold text-[#0068FF]">
                                Trả lời{" "}
                                {getDisplayName(
                                  item.replyTo.author,
                                  "Người dùng",
                                )}
                              </Text>
                              <Text
                                className="mt-1 text-sm leading-5 text-gray-600"
                                numberOfLines={2}
                              >
                                {item.replyTo.content}
                              </Text>
                            </View>
                          ) : null}

                          <Text className="mt-2 text-sm leading-6 text-gray-700">
                            {item.content}
                          </Text>

                          {reactionSummary.length ? (
                            <View className="mt-3 flex-row flex-wrap">
                              {reactionSummary.map((reaction) => (
                                <View
                                  key={`${item.commentId}-${reaction.emoji}`}
                                  className="mr-2 rounded-full bg-[#F4F6FB] px-2.5 py-1"
                                >
                                  <Text className="text-xs font-medium text-gray-700">
                                    {reaction.emoji} {reaction.count}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : null}

                          <View className="mt-3 flex-row items-center">
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => openCommentReactionPicker(item)}
                              className={`mr-4 flex-row items-center ${
                                item.currentUserReaction ? "" : ""
                              }`}
                            >
                              <Text className="text-sm">
                                {activeCommentReaction?.icon || "\u2661"}
                              </Text>
                              <Text
                                className={`ml-1 text-xs font-semibold ${
                                  item.currentUserReaction
                                    ? "text-[#0068FF]"
                                    : "text-gray-500"
                                }`}
                              >
                                {activeCommentReaction?.label ||
                                  "C\u1ea3m x\u00fac"}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => handleReplyToComment(item)}
                              className="flex-row items-center"
                            >
                              <Ionicons
                                name="return-up-back-outline"
                                size={14}
                                color="#6B7280"
                              />
                              <Text className="ml-1 text-xs font-semibold text-gray-500">
                                Trả lời
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View className="items-center rounded-[24px] bg-white px-6 py-10">
                    <Text className="text-sm text-gray-500">
                      Chưa có bình luận nào.
                    </Text>
                  </View>
                }
              />
            )}

            <View
              className="border-t border-gray-200 bg-white px-4 pt-4"
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            >
              {commentReplyTarget ? (
                <View className="mb-3 rounded-[20px] border border-[#DCE7FF] bg-[#F8FBFF] px-3 py-3">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-xs font-semibold text-[#0068FF]">
                        Đang trả lời{" "}
                        {getDisplayName(
                          commentReplyTarget.author,
                          "Người dùng",
                        )}
                      </Text>
                      <Text
                        className="mt-1 text-sm leading-5 text-gray-600"
                        numberOfLines={2}
                      >
                        {commentReplyTarget.content}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setCommentReplyTarget(null)}
                    >
                      <Ionicons name="close" size={18} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              <View className="flex-row items-end rounded-[24px] bg-[#F4F6FB] px-3 py-2">
                <TextInput
                  ref={commentInputRef}
                  value={commentText}
                  onChangeText={setCommentText}
                  onFocus={() => scrollCommentsToEnd(false)}
                  placeholder={
                    commentReplyTarget
                      ? `Trả lời ${getDisplayName(commentReplyTarget.author, "Người dùng")}...`
                      : "Viết bình luận..."
                  }
                  placeholderTextColor="#9CA3AF"
                  multiline
                  className="max-h-28 flex-1 py-2 text-sm text-gray-900"
                />
                <TouchableOpacity
                  disabled={!commentText.trim() || isCommentSubmitting}
                  onPress={handleCommentSubmit}
                  className={`ml-2 h-10 w-10 items-center justify-center rounded-full ${
                    commentText.trim() && !isCommentSubmitting
                      ? "bg-[#0068FF]"
                      : "bg-[#C8D8F9]"
                  }`}
                >
                  <Ionicons name="send" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
