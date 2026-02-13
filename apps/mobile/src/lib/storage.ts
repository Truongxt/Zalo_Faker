import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * AsyncStorage wrapper that matches the Zustand persist storage interface.
 * Used by Zustand's persist middleware for state persistence.
 */
const storage = {
  getItem: async (name: string): Promise<string | null> => {
    return AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await AsyncStorage.removeItem(name);
  },
};

export default storage;
