import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeStorage } from "@/lib/safeStorage";

interface SettingsState {
  soundEnabled: boolean;
  musicEnabled: boolean;
  reducedMotion: boolean;
  setSoundEnabled: (v: boolean) => void;
  setMusicEnabled: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
}

/**
 * Client preferences. Persisted to localStorage (outlives the tab, unlike the
 * ephemeral game identity in store/session.ts). Consumers read these later;
 * this story only stores the preference.
 */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      musicEnabled: true,
      reducedMotion: false,
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    {
      name: "wordspy.settings",
      storage: createJSONStorage(() => safeStorage("local")),
    },
  ),
);
