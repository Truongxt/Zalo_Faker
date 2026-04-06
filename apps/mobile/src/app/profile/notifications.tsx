import { View, Text, ScrollView, TouchableOpacity, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function NotificationsScreen() {
  const router = useRouter();
  const [msgNotif, setMsgNotif] = useState(true);
  const [friendNotif, setFriendNotif] = useState(true);
  const [momentNotif, setMomentNotif] = useState(true);
  const [callNotif, setCallNotif] = useState(true);
  const [sound, setSound] = useState(true);
  const [vibrate, setVibrate] = useState(true);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const Row = ({
    label,
    desc,
    value,
    onChange,
  }: {
    label: string;
    desc?: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <View className="flex-row items-center px-4 py-3.5 border-b border-gray-50">
      <View className="flex-1">
        <Text className="text-gray-900 font-medium">{label}</Text>
        {desc ? <Text className="text-xs text-gray-500 mt-0.5">{desc}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#D1D5DB", true: "#0068FF" }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView>
        {/* Header */}
        <View className="bg-white px-4 py-4 flex-row items-center gap-3 border-b border-gray-100">
          <TouchableOpacity onPress={goBack}>
            <Text className="text-2xl text-[#0068FF]">‹</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900">Thông báo</Text>
        </View>

        {/* Notifications */}
        <View className="bg-white mx-4 my-4 rounded-xl overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-4 pt-4 pb-2">
            Loại thông báo
          </Text>
          <Row
            label="Tin nhắn mới"
            desc="Nhận thông báo khi có tin nhắn mới"
            value={msgNotif}
            onChange={setMsgNotif}
          />
          <Row
            label="Lời mời kết bạn"
            desc="Nhận thông báo khi có người gửi lời mời"
            value={friendNotif}
            onChange={setFriendNotif}
          />
          <Row
            label="Khoảnh khắc"
            desc="Nhận thông báo tương tác nhật ký"
            value={momentNotif}
            onChange={setMomentNotif}
          />
          <Row
            label="Cuộc gọi đến"
            desc="Nhận thông báo khi có cuộc gọi"
            value={callNotif}
            onChange={setCallNotif}
          />
        </View>

        <View className="bg-white mx-4 mb-4 rounded-xl overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-4 pt-4 pb-2">
            Cách thông báo
          </Text>
          <Row label="Âm thanh" value={sound} onChange={setSound} />
          <Row label="Rung" value={vibrate} onChange={setVibrate} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
