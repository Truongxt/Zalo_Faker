import { Image, View, Text } from "react-native";
import { useState } from "react";

interface AvatarProps {
  name?: string;
  uri?: string | null;
  size?: number;
  isGroup?: boolean;
}

export function Avatar({
  name = "User",
  uri,
  size = 40,
  isGroup = false,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const initials = (name ?? "User")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const bgColors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
  ];

  const colorIndex =
    (name ?? "User")
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) % bgColors.length;

  const hasImageUri = !!uri && uri.trim().length > 0 && !imageError;

  return (
    <View
      className={`${bgColors[colorIndex]} rounded-full items-center justify-center`}
      style={{ width: size, height: size, overflow: "hidden" }}
    >
      {isGroup ? (
        <Text style={{ fontSize: size * 0.35 }}>👥</Text>
      ) : hasImageUri ? (
        <Image
          source={{ uri: uri!.trim() }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={(e) => {
            console.warn("[Avatar] Image load failed:", uri, e.nativeEvent.error);
            setImageError(true);
          }}
        />
      ) : (
        <Text
          className="text-white font-bold"
          style={{ fontSize: size * 0.35 }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
