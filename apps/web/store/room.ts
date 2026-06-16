import { create } from "zustand";
import type { RoomSummary } from "@wordspy/types";

interface RoomState {
  room: RoomSummary | null;
  setRoom: (room: RoomSummary) => void;
  clearRoom: () => void;
}

/** Current room the player is in (mirror of server-authoritative state). */
export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
  clearRoom: () => set({ room: null }),
}));
