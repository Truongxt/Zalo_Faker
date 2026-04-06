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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
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
import { userService } from "@/services";
import type { User } from "@/types";

type ProfileForm = {
  fullName: string;
  phone: string;
  birthday: string;
  gender: string;
  avatarUrl: string;
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

  const previewName = isEditing ? form.fullName : profile?.fullName;
  const previewAvatarUri = isEditing ? form.avatarUrl : profile?.avatarUrl;

  const targetUserId = useMemo(() => String(userId || ""), [userId]);
  const isOwnProfile = !!currentUser?.id && currentUser.id === targetUserId;

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
