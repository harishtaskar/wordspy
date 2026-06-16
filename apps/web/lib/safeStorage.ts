import type { StateStorage } from "zustand/middleware";

/**
 * A StateStorage that uses window storage when it's actually functional, and
 * falls back to an in-memory map otherwise (SSR, privacy mode, jsdom opaque
 * origin, or environments where the API is present but unusable).
 */
export function safeStorage(kind: "local" | "session"): StateStorage {
  const memory = new Map<string, string>();

  const backing = (): Storage | null => {
    if (typeof window === "undefined") return null;
    try {
      const s = kind === "local" ? window.localStorage : window.sessionStorage;
      const k = "__wordspy_probe__";
      s.setItem(k, "1");
      s.removeItem(k);
      return s;
    } catch {
      return null;
    }
  };

  return {
    getItem: (name) => {
      const s = backing();
      return s ? s.getItem(name) : (memory.get(name) ?? null);
    },
    setItem: (name, value) => {
      const s = backing();
      if (s) s.setItem(name, value);
      else memory.set(name, value);
    },
    removeItem: (name) => {
      const s = backing();
      if (s) s.removeItem(name);
      else memory.delete(name);
    },
  };
}
