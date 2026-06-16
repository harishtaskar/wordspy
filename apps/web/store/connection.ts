import { create } from "zustand";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface ConnectionState {
  status: ConnectionStatus;
  socketId: string | null;
  protocolVersion: number | null;
  setStatus: (status: ConnectionStatus) => void;
  setWelcome: (payload: { socketId: string; protocolVersion: number }) => void;
  reset: () => void;
}

/**
 * Client-side connection state. The authoritative game state will live on the
 * server (EXPERIENCE.md Foundation); this store only mirrors socket liveness.
 */
export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "connecting",
  socketId: null,
  protocolVersion: null,
  setStatus: (status) => set({ status }),
  setWelcome: ({ socketId, protocolVersion }) =>
    set({ status: "connected", socketId, protocolVersion }),
  reset: () => set({ status: "disconnected", socketId: null, protocolVersion: null }),
}));
