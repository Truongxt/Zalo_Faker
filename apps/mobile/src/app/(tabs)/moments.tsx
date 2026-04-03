import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
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

type ComposerImage = {
  uri: string;
  name?: string;
  mimeType?: string | null;
} | null;

const FEED_OPTIONS: Array<{ key: FeedMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "friends", label: "Ban be", icon: "people-outline" },
  { key: "me", label: "Cua toi", icon: "person-outline" },
  { key: "reacted", label: "Da tha cam xuc", icon: "heart-outline" },
];

const REACTION_OPTIONS = [
  { key: "like", label: "Like" },
  { key: "love", label: "Love" },
  { key: "haha", label: "Haha" },
  { key: "wow", label: "Wow" },
  { key: "sad", label: "Sad" },
  { key: "angry", label: "Angry" },
];

const getDisplayName = (author?: MomentAuthor | null, fallback = "Nguoi dung") =>
  author?.userName || fallback;

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
      <Ionicons
        name={icon}
        size={16}
        color={active ? "white" : "#6B7280"}
      />
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
  const { user } = useAuthStore();
  const [activeFeed, setActiveFeed] = useState<FeedMode>("friends");
  const [moments, setMoments] = useState<Moment[]>([]);
  const [profile, setProfile] = useState<MomentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [composerImage, setComposerImage] = useState<ComposerImage>(null);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentTarget, setCommentTarget] = useState<Moment | null>(null);
  const [comments, setComments] = useState<MomentComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isCommentLoading, setIsCommentLoading] = useState(false);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [actionMomentId, setActionMomentId] = useState<string | null>(null);

  const canPost = useMemo(
    () => Boolean(composerText.trim() || composerImage?.uri) && !isPosting,
    [composerImage?.uri, composerText, isPosting],
  );

  const loadFeed = useCallback(
    async (mode: FeedMode, showSpinner = true) => {
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
      } catch (error: any) {
        console.error("Load moments error:", error?.response?.data || error?.message);
        GrayToast(error?.response?.data?.message || "Khong the tai khoanh khac");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      loadFeed(activeFeed);
    }, [activeFeed, loadFeed]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadFeed(activeFeed, false);
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Can quyen", "Hay cap quyen thu vien anh de dang khoanh khac.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      setComposerImage({
        uri: asset.uri,
        name: asset.fileName || `moment-${Date.now()}.jpg`,
        mimeType: asset.mimeType,
      });
    } catch (error) {
      console.error("Pick moment image error:", error);
      GrayToast("Khong the chon anh");
    }
  };

  const handleCreateMoment = async () => {
    if (!canPost) {
      return;
    }

    try {
      setIsPosting(true);

      await momentService.createMoment({
        content: composerText.trim(),
        imageFile: composerImage,
      });

      setComposerText("");
      setComposerImage(null);
      GrayToast("Dang khoanh khac thanh cong");

      const nextFeed = activeFeed === "reacted" ? "me" : activeFeed;
      if (nextFeed !== activeFeed) {
        setActiveFeed(nextFeed);
      }
      await loadFeed(nextFeed, false);
    } catch (error: any) {
      console.error("Create moment error:", error?.response?.data || error?.message);
      GrayToast(error?.response?.data?.message || "Dang khoanh khac that bai");
    } finally {
      setIsPosting(false);
    }
  };

  const openReactionPicker = (momentId: string) => {
    Alert.alert(
      "Chon cam xuc",
      "Tha cam xuc cho khoanh khac nay",
      [
        ...REACTION_OPTIONS.map((option) => ({
          text: option.label,
          onPress: async () => {
            try {
              setActionMomentId(momentId);
              await momentService.reactToMoment(momentId, option.key);
              await loadFeed(activeFeed, false);
            } catch (error: any) {
              GrayToast(error?.response?.data?.message || "Khong the tha cam xuc");
            } finally {
              setActionMomentId(null);
            }
          },
        })),
        { text: "Huy", style: "cancel" as const },
      ],
    );
  };

  const openComments = async (moment: Moment) => {
    try {
      setCommentTarget(moment);
      setCommentsVisible(true);
      setIsCommentLoading(true);
      const data = await momentService.getMomentComments(moment.momentId);
      setComments(data);
    } catch (error: any) {
      GrayToast(error?.response?.data?.message || "Khong the tai binh luan");
    } finally {
      setIsCommentLoading(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentTarget || !commentText.trim() || isCommentSubmitting) {
      return;
    }

    try {
      setIsCommentSubmitting(true);
      const created = await momentService.commentMoment(
        commentTarget.momentId,
        commentText.trim(),
      );
      setComments((prev) => [...prev, created]);
      setCommentText("");
      await loadFeed(activeFeed, false);
    } catch (error: any) {
      GrayToast(error?.response?.data?.message || "Khong the gui binh luan");
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  const handleShareMoment = (moment: Moment) => {
    Alert.alert("Chia se", "Ban muon chia se khoanh khac nay?", [
      { text: "Huy", style: "cancel" },
      {
        text: "Chia se",
        onPress: async () => {
          try {
            setActionMomentId(moment.momentId);
            await momentService.shareMoment(moment.momentId, "");
            GrayToast("Da chia se khoanh khac");
            await loadFeed(activeFeed, false);
          } catch (error: any) {
            GrayToast(error?.response?.data?.message || "Khong the chia se");
          } finally {
            setActionMomentId(null);
          }
        },
      },
    ]);
  };

  const handleDeleteMoment = (moment: Moment) => {
    Alert.alert("Xoa khoanh khac", "Khoanh khac nay se bi xoa vinh vien.", [
      { text: "Huy", style: "cancel" },
      {
        text: "Xoa",
        style: "destructive",
        onPress: async () => {
          try {
            setActionMomentId(moment.momentId);
            await momentService.deleteMoment(moment.momentId);
            GrayToast("Da xoa khoanh khac");
            await loadFeed(activeFeed, false);
          } catch (error: any) {
            GrayToast(error?.response?.data?.message || "Khong the xoa khoanh khac");
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
      item.isOwner ? user?.fullName || "Ban" : `User ${item.authorId}`,
    );

    return (
      <View className="mb-4 rounded-[24px] bg-white px-4 py-4">
        <View className="flex-row items-start">
          <AvatarBubble
            name={authorName}
            uri={item.author?.avartarUrl || (item.isOwner ? user?.avatarUrl : null)}
          />

          <View className="ml-3 flex-1">
            <View className="flex-row items-center justify-between">
              <View className="pr-3">
                <Text className="text-base font-bold text-gray-900">{authorName}</Text>
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
                {item.mediaUrls.map((url) => (
                  <Image
                    key={url}
                    source={{ uri: url }}
                    className="mr-3 h-48 w-72 rounded-[20px] bg-[#E5E7EB]"
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            ) : null}

            {item.type === "share" && item.originalMomentSnapshot ? (
              <View className="mt-3 rounded-[20px] border border-[#DCE7FF] bg-[#F8FBFF] px-3 py-3">
                <Text className="text-sm font-semibold text-[#0068FF]">
                  Chia se tu {getDisplayName(item.originalMomentSnapshot.author, "Ban be")}
                </Text>
                {item.originalMomentSnapshot.content ? (
                  <Text className="mt-2 text-sm leading-5 text-gray-700">
                    {item.originalMomentSnapshot.content}
                  </Text>
                ) : null}
                {item.originalMomentSnapshot.mediaUrls?.[0] ? (
                  <Image
                    source={{ uri: item.originalMomentSnapshot.mediaUrls[0] }}
                    className="mt-3 h-40 w-full rounded-[18px] bg-[#E5E7EB]"
                    resizeMode="cover"
                  />
                ) : null}
              </View>
            ) : null}

            <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-[#F7F9FC] px-3 py-2">
              <Text className="text-xs font-medium text-gray-500">
                {item.reactionCount} cam xuc
              </Text>
              <Text className="text-xs font-medium text-gray-500">
                {item.commentCount} binh luan
              </Text>
              <Text className="text-xs font-medium text-gray-500">
                {item.shareCount} chia se
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
                <Ionicons
                  name={item.currentUserReaction ? "heart" : "heart-outline"}
                  size={18}
                  color={item.currentUserReaction ? "#0068FF" : "#6B7280"}
                />
                <Text
                  className={`ml-2 text-sm font-semibold ${
                    item.currentUserReaction ? "text-[#0068FF]" : "text-gray-600"
                  }`}
                >
                  {item.currentUserReaction || "Cam xuc"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openComments(item)}
                className="mr-2 flex-1 flex-row items-center justify-center rounded-2xl bg-[#F4F6FB] px-3 py-3"
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#6B7280" />
                <Text className="ml-2 text-sm font-semibold text-gray-600">Binh luan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleShareMoment(item)}
                className="flex-1 flex-row items-center justify-center rounded-2xl bg-[#F4F6FB] px-3 py-3"
              >
                <Ionicons name="repeat-outline" size={18} color="#6B7280" />
                <Text className="ml-2 text-sm font-semibold text-gray-600">Chia se</Text>
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
            name={user?.fullName || "Ban"}
            uri={user?.avatarUrl}
            size={48}
          />

          <View className="ml-3 flex-1">
            <Text className="text-sm font-semibold text-gray-900">
              Dang khoanh khac moi
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              Chia se cam xuc, hinh anh va cap nhat nhanh voi ban be.
            </Text>
          </View>
        </View>

        <TextInput
          value={composerText}
          onChangeText={setComposerText}
          placeholder="Hom nay cua ban co gi moi?"
          placeholderTextColor="#9CA3AF"
          multiline
          className="mt-4 min-h-[96px] rounded-[22px] bg-[#F6F8FC] px-4 py-4 text-[15px] text-gray-900"
          textAlignVertical="top"
        />

        {composerImage?.uri ? (
          <View className="mt-3">
            <Image
              source={{ uri: composerImage.uri }}
              className="h-48 w-full rounded-[22px]"
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={() => setComposerImage(null)}
              className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-black/60"
            >
              <Ionicons name="close" size={18} color="white" />
            </TouchableOpacity>
          </View>
        ) : null}

        <View className="mt-4 flex-row items-center">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePickImage}
            className="mr-3 flex-row items-center rounded-full bg-[#E8F0FF] px-4 py-3"
          >
            <Ionicons name="image-outline" size={18} color={Colors.primary} />
            <Text className="ml-2 text-sm font-semibold text-[#0068FF]">
              {composerImage?.uri ? "Doi anh" : "Them anh"}
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
              {isPosting ? "Dang..." : "Dang khoanh khac"}
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
                {moments.length} khoanh khac da dang
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
        title: "Chua co khoanh khac tu ban be",
        description: "Khi ban be dang bai moi, feed nay se cap nhat ngay tai day.",
      },
      me: {
        title: "Ban chua dang khoanh khac nao",
        description: "Hay dang bai dau tien de bat dau trang ca nhan cua ban.",
      },
      reacted: {
        title: "Chua co khoanh khac da tha cam xuc",
        description: "Nhung bai ban da react se duoc luu lai de xem nhanh o day.",
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
        visible={commentsVisible}
        animationType="slide"
        onRequestClose={() => setCommentsVisible(false)}
      >
        <View className="flex-1 bg-[#F7F9FC]">
          <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-4">
            <TouchableOpacity onPress={() => setCommentsVisible(false)}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-gray-900">Binh luan</Text>
            <View className="w-6" />
          </View>

          {commentTarget ? (
            <View className="border-b border-gray-200 bg-white px-4 py-3">
              <Text className="text-sm font-semibold text-gray-900">
                {getDisplayName(commentTarget.author, "Tac gia")}
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
              <Text className="text-sm text-gray-500">Dang tai binh luan...</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.commentId}
              contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
              renderItem={({ item }) => (
                <View className="mb-3 rounded-[20px] bg-white px-4 py-3">
                  <View className="flex-row items-start">
                    <AvatarBubble
                      name={getDisplayName(item.author, `User ${item.userId}`)}
                      uri={item.author?.avartarUrl}
                      size={38}
                    />
                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-bold text-gray-900">
                          {getDisplayName(item.author, `User ${item.userId}`)}
                        </Text>
                        <Text className="text-xs text-gray-500">
                          {formatRelativeTime(item.createdAt)}
                        </Text>
                      </View>
                      <Text className="mt-1 text-sm leading-6 text-gray-700">
                        {item.content}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View className="items-center rounded-[24px] bg-white px-6 py-10">
                  <Text className="text-sm text-gray-500">
                    Chua co binh luan nao.
                  </Text>
                </View>
              }
            />
          )}

          <View className="border-t border-gray-200 bg-white px-4 py-4">
            <View className="flex-row items-end rounded-[24px] bg-[#F4F6FB] px-3 py-2">
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Viet binh luan..."
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
      </Modal>
    </View>
  );
}
