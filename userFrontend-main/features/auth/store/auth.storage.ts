import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

let secureStoreModulePromise: Promise<SecureStoreModule | null> | null = null;

async function getSecureStoreModule() {
  if (!secureStoreModulePromise) {
    secureStoreModulePromise = import("expo-secure-store")
      .then((module) => module)
      .catch((error) => {
        console.warn(
          "[AuthStorage] expo-secure-store native module unavailable, falling back to AsyncStorage.",
          error,
        );
        return null;
      });
  }

  return secureStoreModulePromise;
}

export const secureStateStorage: StateStorage = {
  getItem: async (name) => {
    const secureStore = await getSecureStoreModule();

    if (secureStore) {
      return secureStore.getItemAsync(name);
    }

    return AsyncStorage.getItem(name);
  },
  setItem: async (name, value) => {
    const secureStore = await getSecureStoreModule();

    if (secureStore) {
      await secureStore.setItemAsync(name, value);
      return;
    }

    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    const secureStore = await getSecureStoreModule();

    if (secureStore) {
      await secureStore.deleteItemAsync(name);
      return;
    }

    await AsyncStorage.removeItem(name);
  },
};
