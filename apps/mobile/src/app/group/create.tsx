import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ScrollView,
} from "react-native";
import { useState, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/services/apiClient";
import { router } from "expo-router";

export default function CreateGroupScreen() {
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [nameError, setNameError] = useState("");

  const nameInputRef = useRef<TextInput>(null);

  const userId = useAuthStore((state) => state.user?.id);

  const friends = [
    {
      id: "1",
      name: "Trần Xuân Trường",
      avatar: "https://i.pravatar.cc/100?img=1",
    },
    {
      id: "2",
      name: "Trần Việt Nhân",
      avatar: "https://i.pravatar.cc/100?img=2",
    },
    {
      id: "3",
      name: "Nguyễn Nhật Dương",
      avatar: "https://i.pravatar.cc/100?img=3",
    },
    { id: "4", name: "Việt Nhân", avatar: "https://i.pravatar.cc/100?img=4" },
    {
      id: "5",
      name: "Lê Minh Tiến",
      avatar: "https://i.pravatar.cc/100?img=5",
    },
    { id: "6", name: "Hà Như", avatar: "https://i.pravatar.cc/100?img=9" },
  ];

  const toggleMember = (id: string) => {
    if (selectedMembers.includes(id)) {
      setSelectedMembers(selectedMembers.filter((m) => m !== id));
    } else {
      setSelectedMembers([...selectedMembers, id]);
    }
  };

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedUsers = friends.filter((f) => selectedMembers.includes(f.id));

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setNameError("Vui lòng nhập tên nhóm");
      nameInputRef.current?.focus();
      return;
    }

    try {
      const res = await apiClient.post(
        "/api/groups",
        {
          name: groupName,
          avatar: "",
          memberIds: selectedMembers,
          createdBy: userId,
        },
        {
          baseURL: "http://192.168.1.24:3000",
        },
      );

      console.log("Group created:", res.data);

      router.replace("/contacts/groups");
    } catch (err: any) {
      console.log("Create group error:", err.response?.data || err.message);
    }
  };

  const renderFriend = ({ item }: any) => {
    const selected = selectedMembers.includes(item.id);

    return (
      <TouchableOpacity
        onPress={() => toggleMember(item.id)}
        className="flex-row items-center px-4 py-3"
      >
        <View
          className={`w-5 h-5 border rounded-full mr-3 items-center justify-center ${
            selected ? "bg-blue-500 border-blue-500" : ""
          }`}
        >
          {selected && <Text className="text-white text-xs">✓</Text>}
        </View>

        <Image
          source={{ uri: item.avatar }}
          className="w-10 h-10 rounded-full mr-3"
        />

        <Text className="text-base">{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-white">
      {/* HEADER */}
      <View className="flex-row justify-between items-center px-4 py-3 border-b">
        <Text className="text-lg font-bold">Tạo nhóm</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-xl">✕</Text>
        </TouchableOpacity>
      </View>

      {/* GROUP NAME */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity className="w-12 h-12 bg-gray-200 rounded-full items-center justify-center mr-3">
          <Text className="text-xl">📷</Text>
        </TouchableOpacity>

        <View className="flex-1">
          <TextInput
            ref={nameInputRef}
            placeholder="Nhập tên nhóm..."
            value={groupName}
            onChangeText={(text) => {
              setGroupName(text);
              if (text) setNameError("");
            }}
            className={`border-b pb-1 text-base ${
              nameError ? "border-red-500" : ""
            }`}
          />

          {nameError && (
            <Text className="text-red-500 text-xs mt-1">{nameError}</Text>
          )}
        </View>
      </View>

      {/* SEARCH */}
      <View className="px-4 mb-2">
        <TextInput
          placeholder="Tìm bạn bè..."
          value={search}
          onChangeText={setSearch}
          className="bg-gray-100 px-4 py-2 rounded-full"
        />
      </View>

      {/* SELECTED USERS */}
      {selectedUsers.length > 0 && (
        <ScrollView horizontal className="px-4 py-2">
          {selectedUsers.map((user) => (
            <View key={user.id} className="items-center mr-3">
              <Image
                source={{ uri: user.avatar }}
                className="w-12 h-12 rounded-full"
              />
              <Text className="text-xs mt-1">{user.name}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* FRIEND LIST */}
      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
      />

      {/* FOOTER */}
      <View className="flex-row justify-end px-4 py-3 border-t">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Text className="text-gray-500">Hủy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCreateGroup}
          className="bg-blue-500 px-5 py-2 rounded"
        >
          <Text className="text-white">Tạo nhóm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
