// Unambiguous uppercase alphabet — no 0/O/1/I to avoid share-link confusion.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

function randomCode(length = CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * Generate a room code not already taken, per the `taken` predicate.
 * Gives up after a bounded number of attempts (registry should be tiny).
 */
export function generateRoomCode(taken: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = randomCode();
    if (!taken(code)) return code;
  }
  throw new Error("Could not allocate a unique room code");
}

export const ROOM_CODE_ALPHABET = ALPHABET;
export const ROOM_CODE_LENGTH = CODE_LENGTH;
