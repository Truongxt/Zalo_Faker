import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type MessageActionItem = {
  key: string;
  text: string;
  style?: "default" | "destructive" | "cancel";
  onPress?: () => void;
};

interface MessageActionModalProps {
  visible: boolean;
  title?: string;
  options: MessageActionItem[];
  onClose: () => void;
}

export function MessageActionModal({
  visible,
  title = "Tùy chọn",
  options,
  onClose,
}: MessageActionModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {options.map((option, index) => {
              const isDestructive = option.style === "destructive";
              const isCancel = option.style === "cancel";

              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => {
                    onClose();
                    setTimeout(() => option.onPress?.(), 80);
                  }}
                  style={[
                    styles.optionButton,
                    index === 0 && styles.optionButtonFirst,
                    index === options.length - 1 && styles.optionButtonLast,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isDestructive && styles.optionTextDestructive,
                      isCancel && styles.optionTextCancel,
                    ]}
                  >
                    {option.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "72%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  list: {
    maxHeight: 420,
  },
  listContent: {
    paddingBottom: 4,
  },
  optionButton: {
    minHeight: 58,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  optionButtonFirst: {
    marginTop: 2,
  },
  optionButtonLast: {
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1D4ED8",
    textAlign: "center",
  },
  optionTextDestructive: {
    color: "#EF4444",
  },
  optionTextCancel: {
    fontWeight: "700",
    color: "#2563EB",
  },
});
