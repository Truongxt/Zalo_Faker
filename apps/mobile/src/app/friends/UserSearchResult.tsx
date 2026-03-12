import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/ui";
import type { User } from "@/types";
import { userService } from "@/services/userService";

export default function UserSearchResult() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  // Mock user data - replace with actual user data from API
  const [friend, setFriend] = useState<User>();
  const [isLoading, setIsLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const hasCover = !!friend?.avatarUrl;
  const navCircleBg = hasCover ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.08)";
  const navIconColor = hasCover ? "white" : "#111827";

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        const foundUser: User = await userService.getUserById(
          params.userId as string,
        );
        setFriend(foundUser);
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [params.userId]);

  const handleAddFriend = () => {
    // TODO: Implement add friend logic
    console.log("Add friend:", friend?.id);
    router.push(`/friends/requests?userId=${friend?.id}`);
  };

  const handleSendMessage = () => {
    // TODO: Navigate to chat with this user
    router.push(`/chat/${friend?.id}`);
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header with Cover Image */}
        <View
          className="relative bg-white"
          style={{ height: 200, paddingTop: insets.top }}
        >
          {friend?.avatarUrl ? (
            <ImageBackground
              source={{ uri: friend.avatarUrl }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              resizeMode="cover"
            >
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.3)",
                }}
              />
            </ImageBackground>
          ) : (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "#ffffff",
              }}
            />
          )}

          {/* Top Navigation */}
          <View className="flex-row justify-between items-center px-4 py-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: navCircleBg }}
            >
              <Ionicons name="arrow-back" size={24} color={navIconColor} />
            </TouchableOpacity>

            <View className="flex-row gap-4">
              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: navCircleBg }}
                onPress={() => {
                  /* Handle call */
                }}
              >
                <Ionicons name="call" size={20} color={navIconColor} />
              </TouchableOpacity>
              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: navCircleBg }}
                onPress={() => {
                  /* Handle more options */
                }}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={navIconColor}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Profile Info Section */}
        <View className="items-center -mt-20 px-4 bg-white">
          {/* Avatar with border */}
          <View className="bg-white rounded-full p-1 mb-4 shadow-lg">
            {friend?.avatarUrl ? (
              <Image
                source={{ uri: friend.avatarUrl }}
                className="w-32 h-32 rounded-full"
              />
            ) : (
              <Avatar name={friend?.fullName} size={128} />
            )}
          </View>

          {/* Name and Edit Button */}
          <View className="flex-row items-center mb-2">
            <Text className="text-2xl font-bold text-gray-900">
              {friend?.fullName}
            </Text>
            <TouchableOpacity className="ml-2">
              <Ionicons name="create-outline" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Privacy Message */}
          <Text className="text-sm text-gray-500 text-center mb-6 px-4">
            Bạn chưa thể xem nhật ký của{" "}
            {friend?.fullName?.split(" ")?.[0] ?? "bạn"} khi chưa là bạn bè
          </Text>

          {/* Action Buttons */}
          <View className="flex-row gap-3 w-full px-4 mb-6">
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={isLoading}
              className={`flex-1 rounded-full py-3 flex-row items-center justify-center ${
                isLoading ? "bg-gray-300" : "bg-blue-500"
              }`}
            >
              <Ionicons
                name="chatbubble"
                size={20}
                color={isLoading ? "#666" : "white"}
              />
              <Text
                className={`font-semibold ml-2 ${
                  isLoading ? "text-gray-600" : "text-white"
                }`}
              >
                Nhắn tin
              </Text>
            </TouchableOpacity>

            {!isFriend && !isLoading && (
              <TouchableOpacity
                onPress={handleAddFriend}
                className="bg-gray-100 rounded-full w-12 h-12 items-center justify-center"
              >
                <Ionicons name="person-add" size={24} color="#0068FF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Info Sections */}
        <View className="px-4 pb-6">
          {/* Basic Info */}
          {friend?.phone && (
            <View className="bg-gray-50 rounded-xl p-4 mb-3">
              <View className="flex-row items-center">
                <Ionicons name="call-outline" size={20} color="#666" />
                <Text className="ml-3 text-base text-gray-800">
                  {friend?.phone}
                </Text>
              </View>
            </View>
          )}

          {friend?.bio && (
            <View className="bg-gray-50 rounded-xl p-4 mb-3">
              <View className="flex-row items-start">
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#666"
                />
                <Text className="ml-3 text-base text-gray-800 flex-1">
                  {friend?.bio}
                </Text>
              </View>
            </View>
          )}

          {/* Mutual Friends Section */}
          <View className="bg-gray-50 rounded-xl p-4 mb-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Ionicons name="people-outline" size={20} color="#666" />
                <Text className="ml-3 text-base text-gray-800">Bạn chung</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-gray-500 mr-2">0</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </View>
          </View>

          {/* Groups Section */}
          <View className="bg-gray-50 rounded-xl p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Ionicons name="grid-outline" size={20} color="#666" />
                <Text className="ml-3 text-base text-gray-800">Nhóm chung</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-gray-500 mr-2">0</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
