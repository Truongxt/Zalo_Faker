import { useState, useEffect } from "react";
import { View, TouchableOpacity, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type Href, useRouter } from "expo-router";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services";

interface HeaderProps {
    onAddPress: () => void;
}

const Header = ({ onAddPress }: HeaderProps) => {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuthStore();
    const { conversations, unlockedHiddenChats, setUnlockedHiddenChats } = useChatStore();
    const [searchQuery, setSearchQuery] = useState("");

    // Check if there are any hidden conversations that are currently locked
    const hasLockedHiddenChats = conversations.some(conv => {
        const participant = conv.participants.find(p => String(p.userId) === String(user?.id));
        return participant?.isHidden && !unlockedHiddenChats;
    });

    const handleSearchChange = async (text: string) => {
        setSearchQuery(text);

        // If user enters a 6-digit numeric PIN
        if (text.length === 6 && /^\d+$/.test(text) && user?.id) {
            try {
                const res = await userService.verifyHiddenPin(user.id, text);
                if (res.success) {
                    setUnlockedHiddenChats(true);
                    setSearchQuery("");
                    Alert.alert("Thành công", "Đã hiện các cuộc trò chuyện ẩn");
                }
            } catch (e) {
                // Not a correct PIN or other error, just treat as normal search
            }
        }
    };

    return (
        <View style={{ backgroundColor: "#0068FF", paddingTop: insets.top }}>
            <View className="px-3 pb-2">
                <View className="flex-row items-center">
                    <View
                        className={`flex-1 flex-row items-center rounded-full px-3 py-1.5 ${
                            hasLockedHiddenChats ? "bg-red-50 border border-red-400" : "bg-white"
                        }`}
                    >
                        <Ionicons name="search" size={18} color={hasLockedHiddenChats ? "#EF4444" : "gray"} />
                        <TextInput
                            placeholder="Tìm kiếm"
                            placeholderTextColor={hasLockedHiddenChats ? "#FCA5A5" : "#9CA3AF"}
                            value={searchQuery}
                            onChangeText={handleSearchChange}
                            keyboardType={searchQuery.length > 0 && /^\d+$/.test(searchQuery) ? "numeric" : "default"}
                            className="ml-2 flex-1 text-gray-900 h-9"
                            autoCapitalize="none"
                        />
                        {unlockedHiddenChats ? (
                            <TouchableOpacity 
                                onPress={() => {
                                    setUnlockedHiddenChats(false);
                                    setSearchQuery("");
                                }}
                                className="flex-row items-center bg-gray-100 px-2 py-1 rounded-full"
                            >
                                <Ionicons name="lock-closed" size={14} color="#0068FF" />
                                <View style={{ marginLeft: 4 }}>
                                    <Ionicons name="close" size={14} color="#0068FF" />
                                </View>
                            </TouchableOpacity>
                        ) : searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                                <Ionicons name="close-circle" size={18} color="#D1D5DB" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <View className="flex-row ml-3 gap-3 items-center">
                        <TouchableOpacity
                            onPress={() => router.push("/search/QRScanner" as Href)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="qr-code-outline" size={24} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onAddPress} activeOpacity={0.7}>
                            <Ionicons name="add" size={26} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
};

export default Header;
