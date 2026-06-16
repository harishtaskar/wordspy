import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SessionState {
  /** Ephemeral per-browser-session id (no account). */
  sessionId: string | null;
  username: string;
  ensureSession: () => void;
  setUsername: (name: string) => void;
}

/**
 * Anonymous, ephemeral identity (FR6): a session id + username persisted to
 * sessionStorage. No account, no server round-trip required to exist.
 */
export const usePlayerSession = create<SessionState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      username: "",
      ensureSession: () => {
        if (!get().sessionId) {
          set({ sessionId: crypto.randomUUID() });
        }
      },
      setUsername: (name) => set({ username: name.trim() }),
    }),
    {
      name: "wordspy.session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
