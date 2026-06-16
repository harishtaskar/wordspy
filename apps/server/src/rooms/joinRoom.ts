import { validateUsername, type JoinRoomRequest } from "@wordspy/types";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../lib/roomCode.js";

export type JoinValidation =
  | { ok: true; code: string; username: string }
  | { ok: false; error: string };

/** Validate an untrusted join payload (cheap checks; registry lookup is the truth). */
export function validateJoin(req: unknown): JoinValidation {
  if (typeof req !== "object" || req === null) {
    return { ok: false, error: "Malformed request." };
  }
  const { code, username } = req as Partial<JoinRoomRequest>;

  const name = validateUsername(username);
  if (!name.ok) {
    return { ok: false, error: name.error ?? "Invalid username." };
  }

  const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (normalized.length !== ROOM_CODE_LENGTH) {
    return { ok: false, error: "Enter a valid room code." };
  }
  if (![...normalized].every((c) => ROOM_CODE_ALPHABET.includes(c))) {
    return { ok: false, error: "Enter a valid room code." };
  }

  return { ok: true, code: normalized, username: name.value };
}
