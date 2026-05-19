import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Avatar } from "@/components/ui/Avatar";
import { useAuthStore } from "@/stores/authStore";
import { userService, momentService } from "@/services";
import { useChatStore } from "@/stores/chatStore";
import { chatService } from "@/services/chat";
import type { User, Moment } from "@/types";

type ProfileForm = {
  fullName: string;
  phone: string;
  birthday: string;
  gender: string;
  avatarUrl: string;
  bio: string;
};

const GENDER_OPTIONS = [
  { label: "Nam", value: "male" },
  { label: "Nữ", value: "female" },
  { label: "Khác", value: "other" },
] as const;

const emptyForm: ProfileForm = {
  fullName: "",
  phone: "",
  birthday: "",
  gender: "male",
  avatarUrl: "",
  bio: "",
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const responseError = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };

    return (
      responseError.response?.data?.message || responseError.message || fallback
    );
  }

  return fallback;
};

const buildForm = (user: User): ProfileForm => ({
  fullName: user.fullName || "",
  phone: user.phone || "",
  birthday: user.birthday || "",
  gender: user.gender || "male",
  avatarUrl: user.avatarUrl || "",
  bio: user.bio || "",
});

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const parseBirthday = (value: string) => {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const isLocalImageUri = (value: string) =>
  value.startsWith("file://") || value.startsWith("content://");

const isVideoUrl = (url?: string | null) => {
  const normalizedUrl = String(url || "")
    .split("?")[0]
    .toLowerCase();
  return [".mp4", ".mov", ".webm", ".m4v"].some((extension) =>
    normalizedUrl.endsWith(extension),
  );
};

const cachePickedAvatar = async (uri: string) => {
  if (!uri || !FileSystem.cacheDirectory) {
    return uri;
  }

  const extFromUri = uri.split("?")[0].split(".").pop()?.toLowerCase();
  const ext = extFromUri || "jpg";
  const destination = `${FileSystem.cacheDirectory}avatar-preview-${Date.now()}.${ext}`;

  try {
    await FileSystem.copyAsync({
      from: uri,
      to: destination,
    });
    return destination;
  } catch {
    // Fallback to original URI if cache copy fails on some providers.
    return uri;
  }
};

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: currentUser, updateUser: updateAuthUser } = useAuthStore();

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [friendMoments, setFriendMoments] = useState<Moment[]>([]);
  const [isLoadingFriendMoments, setIsLoadingFriendMoments] = useState(false);

  const previewName = isEditing ? form.fullName : profile?.fullName;
  const previewAvatarUri = isEditing ? form.avatarUrl : profile?.avatarUrl;

  const targetUserId = useMemo(() => String(userId || ""), [userId]);
  const isOwnProfile = !!currentUser?.id && currentUser.id === targetUserId;

  const mediaStats = useMemo(() => {
    const allMedia = friendMoments.flatMap((moment) => moment.mediaUrls || []);
    const videoCount = allMedia.filter((url) => isVideoUrl(url)).length;
    const imageCount = allMedia.length - videoCount;

    return {
      images: imageCount,
      videos: videoCount,
    };
  }, [friendMoments]);

  const coverImageUri = useMemo(() => {
    const firstMedia = friendMoments
      .flatMap((moment) => moment.mediaUrls || [])
      .find((url) => !isVideoUrl(url));

    return firstMedia || profile?.avatarUrl || null;
  }, [friendMoments, profile?.avatarUrl]);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      if (!targetUserId) {
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        let foundUser: User;

        if (isOwnProfile && currentUser) {
          foundUser = currentUser;
        } else {
          foundUser = await userService.getUserById(targetUserId);
        }

        if (!mounted) {
          return;
        }

        setProfile(foundUser);
        setForm(buildForm(foundUser));
      } catch (error) {
        if (!mounted) {
          return;
        }

        Alert.alert("Lỗi", getErrorMessage(error, "Không thể tải hồ sơ"));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [targetUserId, isOwnProfile, currentUser]);

  useEffect(() => {
    let mounted = true;

    const loadFriendMoments = async () => {
      if (!targetUserId || isOwnProfile) {
        return;
      }

      setIsLoadingFriendMoments(true);
      try {
        const moments = await momentService.getFriendMoments();
        if (!mounted) {
          return;
        }

        const scoped = moments
          .filter((moment) => String(moment.authorId) === String(targetUserId))
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );

        setFriendMoments(scoped);
      } catch (error) {
        if (mounted) {
          setFriendMoments([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingFriendMoments(false);
        }
      }
    };

    void loadFriendMoments();

    return () => {
      mounted = false;
    };
  }, [targetUserId, isOwnProfile]);

  const handleMessageFriend = async () => {
    if (!targetUserId || !currentUser?.id || isOwnProfile) {
      return;
    }

    try {
      const existing = useChatStore
        .getState()
        .conversations.find(
          (c) =>
            c.type === "private" &&
            c.participants.some(
              (p) => String(p.userId) === String(targetUserId),
            ),
        );

      if (existing?.id) {
        router.push({
          pathname: "/(tabs)/chat/[conversationId]",
          params: { conversationId: String(existing.id) },
        });
        return;
      }

      const created = await chatService.createConversation(
        [String(targetUserId)],
        "private",
      );

      router.push({
        pathname: "/(tabs)/chat/[conversationId]",
        params: { conversationId: String(created.id) },
      });
    } catch (error) {
      Alert.alert("Lỗi", "Không thể mở cuộc trò chuyện lúc này");
    }
  };

  const handleOpenFriendOptions = () => {
    if (!targetUserId || isOwnProfile) {
      return;
    }

    router.push({
      pathname: "/profile/friend-options",
      params: {
        userId: String(targetUserId),
        fullName: profile?.fullName || "Người dùng",
      },
    });
  };

  const startEdit = () => {
    if (!profile) {
      return;
    }

    setForm(buildForm(profile));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (profile) {
      setForm(buildForm(profile));
    }
    setShowBirthdayPicker(false);
    setIsEditing(false);
  };

  const onBirthdayChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowBirthdayPicker(false);
    }

    if (event.type === "dismissed") {
      return;
    }

    if (selectedDate) {
      setForm((prev) => ({
        ...prev,
        birthday: formatDate(selectedDate),
      }));
    }
  };

  const pickAvatarFromLibrary = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Cần quyền truy cập",
        "Hãy cấp quyền truy cập thư viện ảnh để chọn avatar.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      return;
    }

    const cachedUri = await cachePickedAvatar(asset.uri);

    setForm((prev) => ({
      ...prev,
      avatarUrl: cachedUri,
    }));
  };

  const onSave = async () => {
    if (!profile) {
      return;
    }

    if (!form.fullName.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập họ và tên");
      return;
    }

    if (!form.phone.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập số điện thoại");
      return;
    }

    setIsSaving(true);
    try {
      const avatarValue = form.avatarUrl.trim();
      const avatarFileUri =
        avatarValue && isLocalImageUri(avatarValue) ? avatarValue : undefined;
      const avatarUrlForUpdate =
        avatarValue && !avatarFileUri ? avatarValue : undefined;

      const updated = await userService.updateUser(
        profile.id,
        {
          userName: form.fullName.trim(),
          phone: form.phone.trim(),
          birthday: form.birthday.trim() || undefined,
          gender: form.gender.trim() || undefined,
          avartarUrl: avatarUrlForUpdate,
          bio: form.bio.trim() || undefined,
        },
        avatarFileUri,
      );

      setProfile(updated);
      setForm(buildForm(updated));
      setIsEditing(false);

      if (isOwnProfile) {
        updateAuthUser({
          fullName: updated.fullName,
          phone: updated.phone,
          avatarUrl: updated.avatarUrl,
          status: updated.status,
        });
      }

      Alert.alert("Thành công", "Đã cập nhật thông tin cá nhân");
    } catch (error) {
      Alert.alert("Lỗi", getErrorMessage(error, "Không thể cập nhật hồ sơ"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center bg-gray-50"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator size="large" color="#0068FF" />
        <Text className="text-gray-500 mt-3">Đang tải hồ sơ...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View
        className="flex-1 items-center justify-center bg-gray-50 px-6"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-lg font-semibold text-gray-900 mb-2">
          Không tìm thấy người dùng
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-4 py-2 rounded-xl bg-[#0068FF]"
        >
          <Text className="text-white font-semibold">Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isOwnProfile) {
    return (
      <SafeAreaView className="flex-1 bg-[#ECECF3]" edges={["top", "bottom"]}>
        <View className="flex-1">
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="relative">
              {coverImageUri ? (
                <ImageBackground
                  source={{ uri: coverImageUri }}
                  style={{ height: 260 }}
                  imageStyle={{ opacity: 0.82 }}
                >
                  <View className="h-full bg-black/20" />
                </ImageBackground>
              ) : (
                <View className="h-[260px] bg-[#AEB8C2]" />
              )}

              <View className="absolute left-0 right-0 top-0 px-3 pt-2">
                <View className="flex-row items-center justify-between">
                  <TouchableOpacity
                    onPress={() => router.back()}
                    className="h-10 w-10 items-center justify-center rounded-full bg-black/20"
                  >
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                  </TouchableOpacity>
                  <View className="flex-row items-center">
                    <TouchableOpacity className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-black/20">
                      <Ionicons name="call-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-black/20">
                      <Ionicons
                        name="settings-outline"
                        size={22}
                        color="#fff"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleOpenFriendOptions}
                      className="h-10 w-10 items-center justify-center rounded-full bg-black/20"
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={22}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View className="absolute bottom-[-60px] left-0 right-0 items-center">
                <View className="rounded-full border-4 border-[#ECECF3]">
                  <Avatar
                    name={profile.fullName || "User"}
                    uri={profile.avatarUrl}
                    size={120}
                  />
                </View>
              </View>
            </View>

            <View className="px-4 pt-16 pb-4 items-center">
              <Text className="text-4xl font-bold text-[#1F2937]">
                {profile.fullName || "Người dùng"}
              </Text>
            </View>

            <View className="px-4 pb-2">
              <View className="flex-row">
                <View className="mr-2 flex-1 rounded-3xl bg-white px-4 py-5">
                  <View className="flex-row items-center">
                    <Ionicons name="images" size={24} color="#3B82F6" />
                    <Text className="ml-3 text-2xl font-semibold text-[#111827]">
                      Ảnh
                    </Text>
                    <Text className="ml-2 text-2xl text-[#6B7280]">
                      {mediaStats.images}
                    </Text>
                  </View>
                </View>
                <View className="ml-2 flex-1 rounded-3xl bg-white px-4 py-5">
                  <View className="flex-row items-center">
                    <Ionicons name="videocam" size={24} color="#22C55E" />
                    <Text className="ml-3 text-2xl font-semibold text-[#111827]">
                      Video
                    </Text>
                    <Text className="ml-2 text-2xl text-[#6B7280]">
                      {mediaStats.videos}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="px-4 pb-28">
              {isLoadingFriendMoments ? (
                <View className="mt-4 items-center py-10">
                  <ActivityIndicator size="large" color="#0068FF" />
                </View>
              ) : friendMoments.length === 0 ? (
                <View className="mt-4 rounded-3xl bg-white p-6">
                  <Text className="text-center text-base text-gray-500">
                    Chưa có khoảnh khắc nào để hiển thị
                  </Text>
                </View>
              ) : (
                friendMoments.map((moment) => {
                  const firstImage = (moment.mediaUrls || []).find(
                    (url) => !isVideoUrl(url),
                  );

                  return (
                    <View
                      key={moment.momentId}
                      className="mt-4 rounded-3xl bg-white p-5"
                    >
                      <Text className="mb-3 text-sm font-medium text-[#6B7280]">
                        {new Date(moment.createdAt).toLocaleDateString("vi-VN")}
                      </Text>
                      <Text className="text-2xl font-semibold text-[#111827]">
                        {moment.content || "Khoảnh khắc"}
                      </Text>
                      {firstImage ? (
                        <Image
                          source={{ uri: firstImage }}
                          resizeMode="cover"
                          className="mt-4 h-48 w-full rounded-2xl"
                        />
                      ) : null}
                      <View className="mt-4 flex-row items-center">
                        <Ionicons name="heart" size={18} color="#EF4444" />
                        <Text className="ml-2 text-base text-[#6B7280]">
                          {moment.reactionCount} bạn
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            onPress={() => void handleMessageFriend()}
            activeOpacity={0.9}
            className="absolute bottom-6 right-5 flex-row items-center rounded-full bg-white px-6 py-3 shadow"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
              elevation: 6,
            }}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={24}
              color="#0A67DA"
            />
            <Text className="ml-2 text-3xl font-semibold text-[#0A67DA]">
              Nhắn tin
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-gray-50"
      >
        <ScrollView
          className="flex-1 bg-gray-50"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row items-center justify-between px-4 h-12">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-[#0068FF] text-base">← Quay lại</Text>
            </TouchableOpacity>

            {isOwnProfile && !isEditing ? (
              <TouchableOpacity onPress={startEdit}>
                <Text className="text-[#0068FF] text-base font-medium">
                  Chỉnh sửa
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View className="items-center py-8 bg-white mb-2">
            <Avatar
              name={previewName || "User"}
              uri={previewAvatarUri}
              size={80}
            />
            <Text className="text-xl font-bold text-gray-900 mt-4">
              {previewName || "-"}
            </Text>
            <Text className="text-gray-500 mt-1">{profile.email}</Text>
            <Text className="text-gray-400 mt-1 text-xs">ID: {profile.id}</Text>
          </View>

          {isEditing ? (
            <View className="bg-white px-4 py-5 mb-2 gap-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Họ và tên
                </Text>
                <TextInput
                  value={form.fullName}
                  onChangeText={(value) =>
                    setForm((prev) => ({ ...prev, fullName: value }))
                  }
                  placeholder="Nhập họ và tên"
                  className="h-12 px-4 bg-gray-100 rounded-xl text-gray-900"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Số điện thoại
                </Text>
                <TextInput
                  value={form.phone}
                  onChangeText={(value) =>
                    setForm((prev) => ({ ...prev, phone: value }))
                  }
                  placeholder="Nhập số điện thoại"
                  keyboardType="phone-pad"
                  className="h-12 px-4 bg-gray-100 rounded-xl text-gray-900"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Ngày sinh
                </Text>
                <TouchableOpacity
                  onPress={() => setShowBirthdayPicker((current) => !current)}
                  className="h-12 px-4 bg-gray-100 rounded-xl justify-center"
                  activeOpacity={0.8}
                >
                  <Text
                    className={
                      form.birthday ? "text-gray-900" : "text-gray-400"
                    }
                  >
                    {form.birthday || "Chọn ngày sinh"}
                  </Text>
                </TouchableOpacity>

                {showBirthdayPicker ? (
                  <View className="mt-2 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden">
                    <DateTimePicker
                      value={parseBirthday(form.birthday)}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={onBirthdayChange}
                    />
                  </View>
                ) : null}
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2">
                  Giới tính
                </Text>
                <View className="flex-row gap-2">
                  {GENDER_OPTIONS.map((option) => {
                    const active = form.gender === option.value;

                    return (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() =>
                          setForm((prev) => ({ ...prev, gender: option.value }))
                        }
                        className="flex-1 h-11 rounded-xl items-center justify-center border"
                        style={{
                          borderColor: active ? "#0068FF" : "#D1D5DB",
                          backgroundColor: active ? "#EFF6FF" : "#F9FAFB",
                        }}
                      >
                        <Text
                          className="font-semibold"
                          style={{ color: active ? "#0068FF" : "#374151" }}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Bio */}
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Giới thiệu
                </Text>
                <TextInput
                  value={form.bio}
                  onChangeText={(value) =>
                    setForm((prev) => ({ ...prev, bio: value }))
                  }
                  placeholder="Viết vài dòng về bản thân..."
                  multiline
                  numberOfLines={3}
                  className="px-4 py-3 bg-gray-100 rounded-xl text-gray-900"
                  textAlignVertical="top"
                  style={{ minHeight: 80 }}
                />
              </View>

              <View className="gap-3">
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Avatar
                </Text>

                <View className="flex-row items-center gap-3">
                  <Avatar
                    name={form.fullName || profile.fullName || "User"}
                    uri={form.avatarUrl}
                    size={72}
                  />

                  <View className="flex-1 gap-2">
                    <TouchableOpacity
                      onPress={() => void pickAvatarFromLibrary()}
                      className="h-11 rounded-xl bg-[#0068FF] items-center justify-center"
                    >
                      <Text className="text-white font-semibold">
                        Chọn ảnh từ thư viện
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        setForm((prev) => ({ ...prev, avatarUrl: "" }))
                      }
                      className="h-11 rounded-xl border border-gray-300 items-center justify-center"
                    >
                      <Text className="text-gray-700 font-semibold">
                        Xóa ảnh
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text className="text-xs text-gray-500 leading-4">
                  Ảnh chọn từ thư viện sẽ được upload lên server trước khi lưu.
                </Text>
              </View>

              <View className="flex-row gap-3 mt-2">
                <TouchableOpacity
                  onPress={cancelEdit}
                  disabled={isSaving}
                  className="flex-1 h-12 items-center justify-center rounded-xl border border-gray-300"
                >
                  <Text className="text-gray-700 font-semibold">Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onSave}
                  disabled={isSaving}
                  className="flex-1 h-12 items-center justify-center rounded-xl bg-[#0068FF]"
                  style={{ opacity: isSaving ? 0.7 : 1 }}
                >
                  {isSaving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-semibold">
                      Lưu thay đổi
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View className="bg-white px-4 py-5 mb-2 gap-4">
              <View>
                <Text className="text-xs text-gray-500">Họ và tên</Text>
                <Text className="text-base text-gray-900 mt-1">
                  {profile.fullName || "-"}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-gray-500">Email</Text>
                <Text className="text-base text-gray-900 mt-1">
                  {profile.email || "-"}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-gray-500">Số điện thoại</Text>
                <Text className="text-base text-gray-900 mt-1">
                  {profile.phone || "-"}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-gray-500">Trạng thái</Text>
                <Text className="text-base text-gray-900 mt-1">
                  {profile.status || "-"}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
