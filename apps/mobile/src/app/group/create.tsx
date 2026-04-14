import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Avatar } from "@/components/ui/Avatar";
import { Button, CenterLoading, GrayToast } from "@/components/ui";
import { Colors } from "@/constants/colors";
import { createGroup, type GroupAvatarFile } from "@/services/groupService";
import { friendsService, userService } from "@/services";
import { useAuthStore } from "@/stores";
import type { Friends, User } from "@/types";

type FriendOption = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

const mapFriendToOption = (friend: Friends, currentUserId: string, usersById: Record<string, User>) => {
  const friendId =
    String(friend.fromUserId) === String(currentUserId)
      ? String(friend.toUserId)
      : String(friend.fromUserId);
  const friendUser = usersById[friendId];

  return {
    id: friendId,
    name: friendUser?.fullName || `User ${friendId}`,
    avatarUrl: friendUser?.avatarUrl || null,
  };
};

const dedupeFriendOptions = (options: FriendOption[]) =>
  Array.from(
    options.reduce<Map<string, FriendOption>>((acc, option) => {
      if (!acc.has(option.id)) {
        acc.set(option.id, option);
      }
      return acc;
    }, new Map()).values(),
  );

export default function CreateGroupScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const nameInputRef = useRef<TextInput>(null);

  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [groupAvatar, setGroupAvatar] = useState<GroupAvatarFile | null>(null);

  useEffect(() => {
    const loadFriends = async () => {
      if (!user?.id) {
        return;
      }

      try {
        setIsLoadingFriends(true);

        const relations = await friendsService.getFriend(user.id);
        const friendIds = relations.map((friend) =>
          String(friend.fromUserId) === String(user.id)
            ? String(friend.toUserId)
            : String(friend.fromUserId),
        );

        const uniqueFriendIds = [...new Set(friendIds)];
        const users = await Promise.all(
          uniqueFriendIds.map((friendId) => userService.getUserById(friendId)),
        );

        const usersById = users.reduce<Record<string, User>>((acc, friendUser) => {
          acc[friendUser.id] = friendUser;
          return acc;
        }, {});

        const options = dedupeFriendOptions(
          relations.map((friend) =>
            mapFriendToOption(friend, user.id, usersById),
          ),
        );

        setFriends(options);
      } catch (error) {
        console.error("Load friends for group error:", error);
        GrayToast("Khong the tai danh sach ban be");
      } finally {
        setIsLoadingFriends(false);
      }
    };

    loadFriends();
  }, [user?.id]);

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const selectedUsers = friends.filter((friend) =>
    selectedMembers.includes(friend.id),
  );

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => {
      const exists = prev.includes(id);
      const nextValue = exists ? prev.filter((memberId) => memberId !== id) : [...prev, id];

      if (nextValue.length > 0) {
        setMemberError("");
      }

      return nextValue;
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setNameError("Vui long nhap ten nhom");
      nameInputRef.current?.focus();
      return;
    }

    if (selectedMembers.length === 0) {
      setMemberError("Hay chon it nhat 1 thanh vien");
      return;
    }

    try {
      setIsSubmitting(true);

      await createGroup({
        name: groupName.trim(),
        avatar: "",
        memberIds: selectedMembers,
        avatarFile: groupAvatar,
      });

      GrayToast("Tao nhom thanh cong");
      router.replace("/contacts/groups");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tao nhom that bai";
      console.error("Create group error:", error);
      GrayToast(message || "Tao nhom that bai");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Can quyen truy cap", "Hay cap quyen thu vien anh de chon avatar nhom.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];

      setGroupAvatar({
        uri: asset.uri,
        name: asset.fileName || `group-avatar-${Date.now()}.jpg`,
        mimeType: asset.mimeType,
      });
    } catch (error) {
      console.error("Pick group avatar error:", error);
      GrayToast("Khong the chon anh dai dien");
    }
  };

  const renderSelectedMember = (friend: FriendOption) => (
    <Pressable
      key={friend.id}
      onPress={() => toggleMember(friend.id)}
      className="mr-3 items-center"
    >
      <View>
        <Avatar uri={friend.avatarUrl} name={friend.name} size={52} />
        <View className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-black/70">
          <Ionicons name="close" size={12} color="white" />
        </View>
      </View>
      <Text className="mt-2 max-w-[72px] text-center text-xs font-medium text-gray-700" numberOfLines={2}>
        {friend.name}
      </Text>
    </Pressable>
  );

  const renderFriendItem = ({ item }: { item: FriendOption }) => {
    const selected = selectedMembers.includes(item.id);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => toggleMember(item.id)}
        className="mx-4 mb-3 flex-row items-center rounded-2xl border border-gray-100 bg-white px-4 py-3"
      >
        <View
          className={`mr-3 h-6 w-6 items-center justify-center rounded-full border ${
            selected ? "border-[#0068FF] bg-[#0068FF]" : "border-gray-300 bg-white"
          }`}
        >
          {selected ? <Ionicons name="checkmark" size={14} color="white" /> : null}
        </View>

        <Avatar uri={item.avatarUrl} name={item.name} size={48} />

        <View className="ml-3 flex-1">
          <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
          <Text className="mt-1 text-sm text-gray-500">
            {selected ? "Da duoc them vao nhom" : "Nhan de chon thanh vien"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-[#F3F7FD]">
      <CenterLoading visible={isLoadingFriends || isSubmitting} />

      <View
        className="rounded-b-[28px] bg-[#0068FF] px-5 pb-5"
        style={{ paddingTop: insets.top + 10 }}
      >
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/15"
          >
            <Ionicons name="close" size={22} color="white" />
          </TouchableOpacity>

          <View className="items-center">
            <Text className="text-lg font-bold text-white">Tao nhom</Text>
            <Text className="mt-1 text-sm text-white/80">
              {selectedMembers.length} thanh vien duoc chon
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleCreateGroup}
            disabled={isSubmitting}
            className="h-11 min-w-[84px] items-center justify-center rounded-full bg-white"
          >
            <Text className="text-sm font-bold text-[#0068FF]">Tao</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-5 rounded-[26px] bg-white px-4 py-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePickAvatar}
              className="mr-3"
            >
              {groupAvatar?.uri ? (
                <View>
                  <Image
                    source={{ uri: groupAvatar.uri }}
                    className="h-14 w-14 rounded-full"
                  />
                  <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full bg-[#0068FF]">
                    <Ionicons name="camera" size={12} color="white" />
                  </View>
                </View>
              ) : (
                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#E8F0FF]">
                  <Ionicons name="camera-outline" size={24} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-[1px] text-[#0068FF]">
                Ten nhom
              </Text>
              <TextInput
                ref={nameInputRef}
                placeholder="VD: Team mobile, Ban than..."
                placeholderTextColor="#9CA3AF"
                value={groupName}
                onChangeText={(text) => {
                  setGroupName(text);
                  if (text.trim()) {
                    setNameError("");
                  }
                }}
                className="rounded-2xl bg-[#F6F9FF] px-4 py-3 text-base text-gray-900"
              />
            </View>
          </View>

          {nameError ? (
            <Text className="mt-3 text-sm font-medium text-red-500">{nameError}</Text>
          ) : (
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-sm text-gray-500">
                Ten nhom se hien thi voi tat ca thanh vien.
              </Text>
              <TouchableOpacity onPress={handlePickAvatar}>
                <Text className="text-sm font-semibold text-[#0068FF]">
                  {groupAvatar?.uri ? "Doi anh" : "Chon anh"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View className="flex-1 px-4 pt-4">
        <View className="mb-4 rounded-[24px] bg-white px-4 py-3 shadow-sm">
          <View className="flex-row items-center rounded-2xl bg-[#F6F9FF] px-4 py-3">
            <Ionicons name="search" size={18} color="#6B7280" />
            <TextInput
              placeholder="Tim ban be de them vao nhom"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              className="ml-3 flex-1 text-base text-gray-900"
            />
          </View>

          {selectedUsers.length > 0 ? (
            <View className="mt-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-gray-900">Da chon</Text>
                <Text className="text-sm text-[#0068FF]">{selectedUsers.length} nguoi</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedUsers.map(renderSelectedMember)}
              </ScrollView>
            </View>
          ) : null}

          {memberError ? (
            <Text className="mt-4 text-sm font-medium text-red-500">{memberError}</Text>
          ) : null}
        </View>

        <View className="mb-3 flex-row items-center justify-between px-1">
          <Text className="text-sm font-semibold text-gray-700">Bạn bè</Text>
          <Text className="text-sm text-gray-500">{filteredFriends.length} ket qua</Text>
        </View>

        {isLoadingFriends ? null : filteredFriends.length === 0 ? (
          <View className="mt-8 items-center rounded-[28px] bg-white px-6 py-10">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#E8F0FF]">
              <Ionicons name="people-outline" size={28} color={Colors.primary} />
            </View>
            <Text className="text-base font-semibold text-gray-900">
              {friends.length === 0 ? "Chua co ban be de tao nhom" : "Khong tim thay ban phu hop"}
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-gray-500">
              {friends.length === 0
                ? "Hay ket ban truoc, sau do quay lai day de tao nhom."
                : "Thu doi tu khoa tim kiem hoac xoa bot ky tu."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredFriends}
            keyExtractor={(item) => item.id}
            renderItem={renderFriendItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
          />
        )}
      </View>

      <View className="border-t border-gray-200 bg-white px-4 pb-6 pt-4">
        <View className="flex-row items-center">
          <Button
            title="Huy"
            variant="secondary"
            size="lg"
            onPress={() => router.back()}
            className="mr-3 flex-1"
          />
          <Button
            title={selectedMembers.length > 0 ? `Tao nhom (${selectedMembers.length})` : "Tao nhom"}
            size="lg"
            isLoading={isSubmitting}
            disabled={!groupName.trim() || selectedMembers.length === 0}
            onPress={handleCreateGroup}
            className="flex-[1.4]"
          />
        </View>
      </View>
    </View>
  );
}
