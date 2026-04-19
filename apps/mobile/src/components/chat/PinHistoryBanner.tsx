import { View, Text } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import type { Message } from "@/types";

type PinHistoryBannerProps = {
  message: Message;
};

export function PinHistoryBanner({ message }: PinHistoryBannerProps) {
  const action = message.metadata?.action === "unpin" ? "unpin" : "pin";
  const actorName = String(
    message.metadata?.actorName || message.senderName || "User",
  ).trim();
  const previewText = String(message.metadata?.previewText || "").trim();
  const actionText =
    action === "pin"
      ? "\u0111\u00e3 ghim 1 tin nh\u1eafn"
      : "\u0111\u00e3 b\u1ecf ghim 1 tin nh\u1eafn";

  return (
    <View
      style={{
        alignItems: "center",
        marginHorizontal: 18,
        marginVertical: 4,
      }}
    >
      <View
        style={{
          maxWidth: "88%",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 16,
          backgroundColor: "#FFFFFF",
          borderWidth: 1,
          borderColor: "#EEF2F7",
          shadowColor: "#000",
          shadowOpacity: 0.03,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFF3E8",
            marginRight: 6,
          }}
        >
          <Svg
            width={11}
            height={11}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F97316"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Line x1="12" x2="12" y1="17" y2="22" />
            <Path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </Svg>
        </View>

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: "#64748B",
            fontSize: 12,
            lineHeight: 16,
          }}
        >
          <Text style={{ fontWeight: "600", color: "#475569" }}>
            {actorName}
          </Text>
          {` ${actionText}`}
          {previewText ? ` ${previewText}` : ""}
        </Text>
      </View>
    </View>
  );
}
