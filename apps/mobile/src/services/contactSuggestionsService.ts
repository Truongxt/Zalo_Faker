import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Contacts from "expo-contacts";
import { PermissionStatus } from "expo-modules-core";
import { friendsService, type SuggestedFriend } from "./friendsService";

type ContactSuggestionCache = {
  userId: string;
  phoneHash: string;
  suggestions: SuggestedFriend[];
  updatedAt: number;
};

type SyncOptions = {
  userId: string;
  force?: boolean;
  requestPermission?: boolean;
};

type SyncResult =
  | {
      status: "updated" | "unchanged";
      suggestions: SuggestedFriend[];
      fromCache: boolean;
      permissionStatus: Contacts.PermissionStatus;
    }
  | {
      status: "no_permission";
      suggestions: SuggestedFriend[];
      fromCache: boolean;
      permissionStatus: Contacts.PermissionStatus;
    };

const CACHE_PREFIX = "contact_suggestions_cache_v1";

const getCacheKey = (userId: string) => `${CACHE_PREFIX}:${String(userId || "").trim()}`;

const normalizePhone = (rawPhone: string): string | null => {
  let digits = String(rawPhone || "").replace(/\D/g, "");

  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("84")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length !== 9) return null;
  return `+84${digits}`;
};

const collectNormalizedPhones = (contacts: Contacts.Contact[]): string[] => {
  const phoneSet = new Set<string>();

  (contacts || []).forEach((contact) => {
    (contact.phoneNumbers || []).forEach((phoneObj) => {
      const normalized = normalizePhone(phoneObj.number || "");
      if (normalized) phoneSet.add(normalized);
    });
  });

  return [...phoneSet].sort();
};

const hashPhones = (phones: string[]) => phones.join("|");

const readCache = async (userId: string): Promise<ContactSuggestionCache | null> => {
  const key = getCacheKey(userId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ContactSuggestionCache;
    if (!parsed || typeof parsed !== "object") return null;
    if (String(parsed.userId || "") !== String(userId || "")) return null;
    if (!Array.isArray(parsed.suggestions)) return null;

    return {
      userId: String(parsed.userId || ""),
      phoneHash: String(parsed.phoneHash || ""),
      suggestions: parsed.suggestions || [],
      updatedAt: Number(parsed.updatedAt || 0),
    };
  } catch {
    return null;
  }
};

const writeCache = async (
  userId: string,
  payload: Omit<ContactSuggestionCache, "userId">,
) => {
  const key = getCacheKey(userId);
  const cache: ContactSuggestionCache = {
    userId: String(userId || ""),
    phoneHash: String(payload.phoneHash || ""),
    suggestions: payload.suggestions || [],
    updatedAt: Number(payload.updatedAt || Date.now()),
  };

  await AsyncStorage.setItem(key, JSON.stringify(cache));
};

const ensurePermission = async (
  requestPermission: boolean,
): Promise<Contacts.PermissionStatus> => {
  const current = await Contacts.getPermissionsAsync();
  if (current.status === "granted") return current.status;
  if (!requestPermission) return current.status;

  const requested = await Contacts.requestPermissionsAsync();
  return requested.status;
};

export const contactSuggestionsService = {
  async getCachedSuggestions(userId: string): Promise<SuggestedFriend[]> {
    const cache = await readCache(userId);
    return cache?.suggestions || [];
  },

  async syncSuggestions(options: SyncOptions): Promise<SyncResult> {
    const userId = String(options.userId || "").trim();
    if (!userId) {
      return {
        status: "no_permission",
        suggestions: [],
        fromCache: true,
        permissionStatus: PermissionStatus.UNDETERMINED,
      };
    }

    const cache = await readCache(userId);
    const permissionStatus = await ensurePermission(Boolean(options.requestPermission));

    if (permissionStatus !== "granted") {
      return {
        status: "no_permission",
        suggestions: cache?.suggestions || [],
        fromCache: Boolean(cache),
        permissionStatus,
      };
    }

    const response = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
    });

    const phones = collectNormalizedPhones(response.data || []);
    const phoneHash = hashPhones(phones);

    if (!options.force && cache && cache.phoneHash === phoneHash) {
      return {
        status: "unchanged",
        suggestions: cache.suggestions || [],
        fromCache: true,
        permissionStatus,
      };
    }

    if (!phones.length) {
      await writeCache(userId, {
        phoneHash,
        suggestions: [],
        updatedAt: Date.now(),
      });

      return {
        status: "updated",
        suggestions: [],
        fromCache: false,
        permissionStatus,
      };
    }

    const suggestions = await friendsService.suggestFriendsByPhones(phones);
    await writeCache(userId, {
      phoneHash,
      suggestions,
      updatedAt: Date.now(),
    });

    return {
      status: "updated",
      suggestions,
      fromCache: false,
      permissionStatus,
    };
  },

  async prewarmOnAppOpen(userId: string): Promise<void> {
    try {
      await this.syncSuggestions({
        userId,
        force: false,
        requestPermission: false,
      });
    } catch {
      // Silent prewarm - do not interrupt user flow.
    }
  },
};
