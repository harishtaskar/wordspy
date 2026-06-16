import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import type { RolePayload } from "@wordspy/types";
import { RoleReveal } from "./RoleReveal";

afterEach(cleanup);

const crew: RolePayload = { role: "crew", word: "PIZZA", category: "food" };
const imposter: RolePayload = { role: "imposter", category: "food" };

describe("RoleReveal", () => {
  it("shows the word and a CREW label for crew", () => {
    render(<RoleReveal role={crew} onDone={() => {}} />);
    expect(screen.getByText("PIZZA")).toBeTruthy();
    expect(screen.getByText(/you are crew/i)).toBeTruthy();
  });

  it("shows IMPOSTER + category and never the word for the imposter", () => {
    render(<RoleReveal role={imposter} onDone={() => {}} />);
    expect(screen.getByText("IMPOSTER")).toBeTruthy();
    expect(screen.getByText(/you are the imposter/i)).toBeTruthy();
    expect(screen.getByText(/category: food/i)).toBeTruthy();
    // No word anywhere in the imposter reveal.
    expect(screen.queryByText("PIZZA")).toBeNull();
  });

  it("conveys role with explicit text, not colour alone", () => {
    render(<RoleReveal role={imposter} onDone={() => {}} />);
    expect(screen.getAllByText(/imposter/i).length).toBeGreaterThan(0);
  });

  it("fires onDone when Continue is clicked", () => {
    const onDone = vi.fn();
    render(<RoleReveal role={crew} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("renders the auto-advance countdown and ticks it down", () => {
    vi.useFakeTimers();
    try {
      render(<RoleReveal role={crew} onDone={() => {}} />);
      expect(screen.getByText("0:05")).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText("0:04")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
