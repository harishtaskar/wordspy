import {
  CATEGORIES,
  DISCUSSION_TIMES,
  MAX_PLAYERS_OPTIONS,
  validateUsername,
  type CreateRoomRequest,
  type RoomSettings,
} from "@wordspy/types";

export type ValidationResult =
  | { ok: true; username: string; settings: RoomSettings }
  | { ok: false; error: string };

/** Validate an untrusted create-room payload from the wire. */
export function validateCreateRoom(req: unknown): ValidationResult {
  if (typeof req !== "object" || req === null) {
    return { ok: false, error: "Malformed request." };
  }
  const { username, settings } = req as Partial<CreateRoomRequest>;

  const name = validateUsername(username);
  if (!name.ok) {
    return { ok: false, error: name.error ?? "Invalid username." };
  }
  if (typeof settings !== "object" || settings === null) {
    return { ok: false, error: "Missing settings." };
  }
  const { category, discussionSeconds, maxPlayers, isPrivate } = settings as Partial<RoomSettings>;

  if (!CATEGORIES.includes(category as never)) {
    return { ok: false, error: "Invalid category." };
  }
  if (!DISCUSSION_TIMES.includes(discussionSeconds as never)) {
    return { ok: false, error: "Invalid discussion time." };
  }
  if (!MAX_PLAYERS_OPTIONS.includes(maxPlayers as never)) {
    return { ok: false, error: "Invalid max players." };
  }
  if (typeof isPrivate !== "boolean") {
    return { ok: false, error: "Invalid privacy setting." };
  }

  return {
    ok: true,
    username: name.value,
    settings: { category, discussionSeconds, maxPlayers, isPrivate } as RoomSettings,
  };
}
