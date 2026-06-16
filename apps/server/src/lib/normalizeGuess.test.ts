import { describe, it, expect } from "vitest";
import { normalizeGuess } from "./normalizeGuess.js";

describe("normalizeGuess", () => {
  it("is case/space/punctuation insensitive", () => {
    expect(normalizeGuess("Pizza")).toBe("pizza");
    expect(normalizeGuess("  pizza! ")).toBe("pizza");
    expect(normalizeGuess("PIZZA")).toBe("pizza");
    expect(normalizeGuess("Pizza")).toBe(normalizeGuess("pizza "));
  });
  it("collapses internal punctuation/space", () => {
    expect(normalizeGuess("ice-cream")).toBe("icecream");
    expect(normalizeGuess("ice cream")).toBe("icecream");
  });
});
