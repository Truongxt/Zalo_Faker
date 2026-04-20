import { Image, View, Text } from "react-native";
import { useState, useMemo } from "react";
import { API_URL } from "@/constants/config";

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

  const getFullMediaUrl = (url?: string | null) => {
    if (!url) return undefined;
    const trimmed = url.trim();
    if (!trimmed) return undefined;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("data:")) return trimmed;
    if (trimmed.startsWith("/")) {
      const base = API_URL.replace(/\/+$/, "");
      return `${base}${trimmed}`;
    }
    // Handle cases where it might be relative but not starting with /
    const base = API_URL.replace(/\/+$/, "");
    return `${base}/${trimmed}`;
  };

  const fullUri = useMemo(() => getFullMediaUrl(uri), [uri]);

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

  const hasImage = !!fullUri && !imageError;

  return (
    <View
      className={`${bgColors[colorIndex]} rounded-full items-center justify-center`}
      style={{ width: size, height: size, overflow: "hidden" }}
    >
      {hasImage ? (
        <Image
          source={{ uri: fullUri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={(e) => {
            console.warn("[Avatar] Image load failed:", fullUri, e.nativeEvent.error);
            setImageError(true);
          }}
        />
      ) : isGroup ? (
        <Text style={{ fontSize: size * 0.35 }}>👥</Text>
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
