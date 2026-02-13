import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  initialized: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: true,
      initialized: false,
      error: null,

      setUser: (user) => set({ user, isLoading: false }),

      setAccessToken: (accessToken) => set({ accessToken }),

      setError: (error) => set({ error, isLoading: false }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          isLoading: false,
          error: null,
        }),

      updateProfile: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      initialize: async () => {
        if (get().initialized) return;

        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            const user: User = {
              id: session.user.id,
              email: session.user.email || null,
              phone: session.user.phone || null,
              fullName:
                session.user.user_metadata?.full_name || "User",
              avatarUrl:
                session.user.user_metadata?.avatar_url || null,
              bio: null,
              status: "online",
              lastSeen: null,
              createdAt: session.user.created_at,
            };
            set({
              user,
              accessToken: session.access_token,
              isLoading: false,
              initialized: true,
            });
          } else {
            set({ isLoading: false, initialized: true });
          }
        } catch {
          set({ isLoading: false, initialized: true });
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
          state.initialized = true;
        }
      },
    }
  )
);
