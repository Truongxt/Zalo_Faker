import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Check if we're in a browser environment
const isBrowser = typeof window !== "undefined";

/**
 * AsyncStorage wrapper that matches the Zustand persist storage interface.
 * Used by Zustand's persist middleware for state persistence.
 * Handles SSR by checking for window availability.
 */
const storage = {
  getItem: async (name: string): Promise<string | null> => {
    if (!isBrowser && Platform.OS === "web") return null;
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (!isBrowser && Platform.OS === "web") return;
    try {
      await AsyncStorage.setItem(name, value);
    } catch {}
  },
  removeItem: async (name: string): Promise<void> => {
    if (!isBrowser && Platform.OS === "web") return;
    try {
      await AsyncStorage.removeItem(name);
    } catch {}
  },
};

export default storage;
