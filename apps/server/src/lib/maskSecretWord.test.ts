import { describe, it, expect } from "vitest";
import { maskSecretWord } from "./maskSecretWord.js";

describe("maskSecretWord", () => {
  it("masks the word case-insensitively", () => {
    expect(maskSecretWord("I think it's PIZZA right?", "Pizza")).toBe("I think it's ***** right?");
    expect(maskSecretWord("pizza pizza", "pizza")).toBe("***** *****");
  });
  it("masks the word even inside a larger token", () => {
    expect(maskSecretWord("pizzas are great", "pizza")).toBe("*****s are great");
  });
  it("leaves text untouched when there is no word yet", () => {
    expect(maskSecretWord("hello", undefined)).toBe("hello");
    expect(maskSecretWord("hello", "")).toBe("hello");
  });
  it("does not mask unrelated text", () => {
    expect(maskSecretWord("best when shared", "pizza")).toBe("best when shared");
  });
});
