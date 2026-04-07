import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL, STORAGE_KEYS } from "@/constants/config";
import { useAuthStore } from "@/stores/authStore";

type RequestBody = BodyInit | Record<string, unknown> | unknown[] | null | undefined;

export class FetchApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "FetchApiError";
    this.status = status;
    this.data = data;
  }
}

type ApiFetchOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: RequestBody;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  retryOnUnauthorized?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

const buildUrl = (endpoint: string) =>
  endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

const parseResponseData = async (response: Response) => {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
};

const getStoredAccessToken = async () => {
  let token: string | null = null;

  try {
    token = useAuthStore.getState().accessToken;
  } catch (error) {
    console.warn("[fetchClient] Cannot read access token from store:", error);
  }

  if (!token) {
    token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  if (!token) {
    const persistedAuth = await AsyncStorage.getItem("auth-storage");
    if (persistedAuth) {
      try {
        const parsed = JSON.parse(persistedAuth);
        token = parsed?.state?.accessToken ?? null;
      } catch {
        token = null;
      }
    }
  }

  return token;
};

const getStoredRefreshToken = async () => {
  let token: string | null = null;

  try {
    token = useAuthStore.getState().refreshToken;
  } catch (error) {
    console.warn("[fetchClient] Cannot read refresh token from store:", error);
  }

  if (!token) {
    const persistedAuth = await AsyncStorage.getItem("auth-storage");
    if (persistedAuth) {
      try {
        const parsed = JSON.parse(persistedAuth);
        token = parsed?.state?.refreshToken ?? null;
      } catch {
        token = null;
      }
    }
  }

  return token;
};

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getStoredRefreshToken();

      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await fetch(buildUrl("/api/users/refresh-token"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await parseResponseData(response);

      if (!response.ok || !data || typeof data !== "object" || !("accessToken" in data)) {
        throw new FetchApiError("Khong the lam moi phien dang nhap", response.status, data);
      }

      const accessToken = typeof data.accessToken === "string" ? data.accessToken : null;

      if (!accessToken) {
        throw new Error("Refresh token response is missing accessToken");
      }

      useAuthStore.getState().setAccessToken(accessToken);
      return accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const normalizeBody = (
  body: RequestBody,
  headers: Record<string, string>,
): BodyInit | undefined => {
  if (body == null) {
    return undefined;
  }

  if (
    body instanceof FormData ||
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof URLSearchParams
  ) {
    return body;
  }

  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return JSON.stringify(body);
};

export const apiFetch = async <T>(
  endpoint: string,
  options: ApiFetchOptions = {},
): Promise<T> => {
  const {
    body,
    headers = {},
    requiresAuth = true,
    retryOnUnauthorized = true,
    ...init
  } = options;

  const requestHeaders = { ...headers };

  if (requiresAuth) {
    const token = await getStoredAccessToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const requestBody = normalizeBody(body, requestHeaders);

  const response = await fetch(buildUrl(endpoint), {
    ...init,
    headers: requestHeaders,
    body: requestBody,
  });

  if (response.status === 401 && requiresAuth && retryOnUnauthorized) {
    try {
      const refreshedToken = await refreshAccessToken();

      if (!refreshedToken) {
        throw new Error("Refresh token did not return a new access token");
      }

      return apiFetch<T>(endpoint, {
        ...options,
        headers: {
          ...headers,
          Authorization: `Bearer ${refreshedToken}`,
        },
        retryOnUnauthorized: false,
      });
    } catch (error) {
      useAuthStore.getState().logout();
      throw error;
    }
  }

  const data = await parseResponseData(response);

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data && typeof data.message === "string"
        ? data.message
        : `Request failed with status ${response.status}`;
    throw new FetchApiError(message, response.status, data);
  }

  return data as T;
};
