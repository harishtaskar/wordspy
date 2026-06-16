import { create } from "zustand";
import type { ChatMessage } from "@wordspy/types";

const MAX_KEPT = 100;

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  clear: () => void;
}

/** Ephemeral discussion chat feed (server relays; nothing is persisted). */
export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg].slice(-MAX_KEPT) })),
  clear: () => set({ messages: [] }),
}));
