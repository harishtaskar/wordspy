import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RoleBanner } from "./RoleBanner";

afterEach(cleanup);

describe("RoleBanner", () => {
  it("shows the secret word to crew", () => {
    render(<RoleBanner role={{ role: "crew", word: "Mango", category: "food" }} />);
    expect(screen.getByText("Mango")).toBeTruthy();
    expect(screen.getByText(/drop a clue/i)).toBeTruthy();
  });

  it("never renders a word for the imposter", () => {
    render(<RoleBanner role={{ role: "imposter", category: "food" }} />);
    expect(screen.getByText(/guess the word/i)).toBeTruthy();
    expect(screen.getByText(/imposter/i)).toBeTruthy();
  });
});
