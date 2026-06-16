import { create } from "zustand";
import type { RolePayload } from "@wordspy/types";

interface RoleState {
  role: RolePayload | null;
  setRole: (role: RolePayload) => void;
  clearRole: () => void;
}

/** This player's secret role for the current round (from the per-socket game:role). */
export const useRoleStore = create<RoleState>((set) => ({
  role: null,
  setRole: (role) => set({ role }),
  clearRole: () => set({ role: null }),
}));
