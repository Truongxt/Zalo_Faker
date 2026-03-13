import { View, Text, TouchableOpacity, FlatList, Image } from "react-native";
import { router } from "expo-router";
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import apiClient from "@/services/apiClient";

export default function GroupsScreen() {
  const [groups, setGroups] = useState<any[]>([]);

  // fetch groups
  const fetchGroups = async () => {
    try {
      const res = await apiClient.get("/api/groups");
      setGroups(res.data || []);
    } catch (error) {
      console.log("fetch groups error:", error);
    }
  };

  // reload khi quay lại màn hình
  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, []),
  );

  // render từng group
  const renderGroup = ({ item }: any) => {
    const lastMessage = item.lastMessage?.content || "Chưa có tin nhắn";

    return (
      <TouchableOpacity
        className="flex-row items-center px-4 py-3 bg-white"
        onPress={() => router.push(`/group/${item._id}`)}
      >
        {/* avatar */}
        <Image
          source={{
            uri:
              item.avatar ??
              "https://cdn-icons-png.flaticon.com/512/166/166258.png",
          }}
          className="w-12 h-12 rounded-full mr-3"
        />

        {/* name + message */}
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">
            {item.name}
          </Text>

          <Text className="text-gray-500 text-sm mt-1" numberOfLines={1}>
            {lastMessage}
          </Text>
        </View>

        {/* time */}
        <Text className="text-gray-400 text-xs">
          {item.lastMessage?.timestamp
            ? new Date(item.lastMessage.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* CREATE GROUP */}
      <TouchableOpacity
        onPress={() => router.push("/group/create")}
        className="flex-row items-center px-4 py-3 bg-white"
      >
        <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-3">
          <Text className="text-lg">👥</Text>
        </View>

        <Text className="text-blue-600 font-medium text-base">Tạo nhóm</Text>
      </TouchableOpacity>

      {/* HEADER */}
      <View className="flex-row justify-between px-4 py-2 bg-gray-100">
        <Text className="text-gray-700 font-semibold">
          Nhóm đang tham gia ({groups.length})
        </Text>

        <Text className="text-gray-500 text-sm">Hoạt động cuối</Text>
      </View>

      {/* GROUP LIST */}
      {groups.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Chưa có nhóm nào</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item._id}
          renderItem={renderGroup}
          ItemSeparatorComponent={() => (
            <View className="h-[0.5px] bg-gray-200 ml-16" />
          )}
        />
      )}
    </View>
  );
}
