import { View, Text } from "react-native";

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

  // TODO: Add Image support when uri is available
  return (
    <View
      className={`${bgColors[colorIndex]} rounded-full items-center justify-center`}
      style={{ width: size, height: size }}
    >
      {isGroup ? (
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
