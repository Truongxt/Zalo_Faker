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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.card, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onPress={(event) => event.stopPropagation()}
        >
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
    justifyContent: "flex-end",
  },
  card: {
    width: "100%",
    maxHeight: "78%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "left",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  list: {
    maxHeight: 460,
  },
  listContent: {
    paddingBottom: 8,
  },
  optionButton: {
    minHeight: 60,
    justifyContent: "center",
    alignItems: "flex-start",
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
    fontWeight: "600",
    color: "#111827",
    textAlign: "left",
  },
  optionTextDestructive: {
    color: "#EF4444",
  },
  optionTextCancel: {
    fontWeight: "700",
    color: "#2563EB",
  },
});
