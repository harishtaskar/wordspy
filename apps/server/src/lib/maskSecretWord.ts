/**
 * Mask any appearance of the secret word in a chat message with asterisks.
 * Case-insensitive substring match (so "Pizzas" → "******s"). The server is the
 * only party that reliably knows the word, so this MUST run server-side.
 */
export function maskSecretWord(text: string, secretWord: string | undefined): string {
  if (!secretWord) return text;
  const trimmed = secretWord.trim();
  if (trimmed.length === 0) return text;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), "*".repeat(trimmed.length));
}
