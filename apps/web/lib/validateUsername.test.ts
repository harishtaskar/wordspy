import { describe, it, expect } from "vitest";
import { validateUsername } from "./validateUsername";

describe("validateUsername", () => {
  it("accepts a normal name", () => {
    expect(validateUsername("Aanya")).toEqual({ ok: true, value: "Aanya" });
  });

  it("trims and collapses internal whitespace", () => {
    expect(validateUsername("  Rex   the  Cat ")).toEqual({ ok: true, value: "Rex the Cat" });
  });

  it("rejects empty / whitespace-only", () => {
    expect(validateUsername("   ").ok).toBe(false);
    expect(validateUsername("").ok).toBe(false);
  });

  it("enforces min length", () => {
    expect(validateUsername("A").ok).toBe(false);
  });

  it("enforces max length", () => {
    expect(validateUsername("x".repeat(17)).ok).toBe(false);
    expect(validateUsername("x".repeat(16)).ok).toBe(true);
  });

  it("rejects disallowed characters", () => {
    expect(validateUsername("bad@name").ok).toBe(false);
    expect(validateUsername("emoji😀").ok).toBe(false);
  });

  it("allows underscore and hyphen", () => {
    expect(validateUsername("co-op_99").ok).toBe(true);
  });

  it("rejects blocklisted substrings", () => {
    expect(validateUsername("admin").ok).toBe(false);
    expect(validateUsername("xXadminXx").ok).toBe(false);
  });
});
