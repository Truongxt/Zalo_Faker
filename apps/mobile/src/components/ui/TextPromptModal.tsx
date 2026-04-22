import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TextPromptModalProps {
  visible: boolean;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onClose: () => void;
  onConfirm: (value: string) => void | Promise<void>;
}

export function TextPromptModal({
  visible,
  title,
  message,
  initialValue = "",
  placeholder,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  onClose,
  onConfirm,
}: TextPromptModalProps) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [initialValue, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardWrap}
        >
          <Pressable
            style={[styles.card, { paddingBottom: Math.max(insets.bottom, 16) }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              autoFocus
            />
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.button, styles.cancelButton]}
              >
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onConfirm(value)}
                style={[styles.button, styles.confirmButton]}
              >
                <Text style={styles.confirmText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  keyboardWrap: {
    width: "100%",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
  },
  confirmButton: {
    backgroundColor: "#2563EB",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  confirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
