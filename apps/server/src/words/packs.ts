import { CATEGORIES, type Category } from "@wordspy/types";

export type Difficulty = "easy" | "medium" | "hard";

export interface WordEntry {
  word: string;
  difficulty: Difficulty;
  enabled: boolean;
}

function pack(words: Array<[string, Difficulty]>): WordEntry[] {
  return words.map(([word, difficulty]) => ({ word, difficulty, enabled: true }));
}

/** Static word packs for the six concrete categories. `random` is the union. */
export const WORD_PACKS: Record<Exclude<Category, "random">, WordEntry[]> = {
  food: pack([
    ["Pizza", "easy"],
    ["Sushi", "medium"],
    ["Pancake", "easy"],
    ["Burrito", "medium"],
    ["Ramen", "medium"],
    ["Croissant", "hard"],
    ["Popcorn", "easy"],
    ["Lasagna", "medium"],
    ["Mango", "easy"],
    ["Waffle", "easy"],
  ]),
  movies: pack([
    ["Titanic", "easy"],
    ["Inception", "hard"],
    ["Frozen", "easy"],
    ["Gladiator", "medium"],
    ["Avatar", "easy"],
    ["Joker", "medium"],
    ["Matrix", "medium"],
    ["Up", "easy"],
    ["Jaws", "medium"],
    ["Coco", "easy"],
  ]),
  animals: pack([
    ["Tiger", "easy"],
    ["Penguin", "easy"],
    ["Octopus", "medium"],
    ["Kangaroo", "medium"],
    ["Hedgehog", "medium"],
    ["Dolphin", "easy"],
    ["Chameleon", "hard"],
    ["Sloth", "easy"],
    ["Falcon", "medium"],
    ["Otter", "easy"],
  ]),
  countries: pack([
    ["Brazil", "easy"],
    ["Japan", "easy"],
    ["Egypt", "medium"],
    ["Canada", "easy"],
    ["Norway", "medium"],
    ["Kenya", "medium"],
    ["Thailand", "medium"],
    ["Mexico", "easy"],
    ["Iceland", "hard"],
    ["Portugal", "medium"],
  ]),
  sports: pack([
    ["Football", "easy"],
    ["Tennis", "easy"],
    ["Cricket", "medium"],
    ["Boxing", "easy"],
    ["Surfing", "medium"],
    ["Archery", "hard"],
    ["Hockey", "medium"],
    ["Cycling", "easy"],
    ["Bowling", "easy"],
    ["Rowing", "medium"],
  ]),
  technology: pack([
    ["Laptop", "easy"],
    ["Bluetooth", "medium"],
    ["Robot", "easy"],
    ["Keyboard", "easy"],
    ["Satellite", "hard"],
    ["Drone", "medium"],
    ["Browser", "medium"],
    ["Battery", "easy"],
    ["Firewall", "hard"],
    ["Webcam", "easy"],
  ]),
};

/** Enabled entries for a category; `random` unions every pack. */
export function enabledWords(category: Category): WordEntry[] {
  if (category === "random") {
    return (Object.keys(WORD_PACKS) as Array<Exclude<Category, "random">>)
      .flatMap((c) => WORD_PACKS[c])
      .filter((w) => w.enabled);
  }
  return WORD_PACKS[category].filter((w) => w.enabled);
}

/** Sanity guard used by tests: every concrete category has words. */
export const CONCRETE_CATEGORIES = CATEGORIES.filter((c) => c !== "random");
