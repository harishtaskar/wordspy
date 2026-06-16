import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Timer } from "./Timer";

afterEach(cleanup);

describe("Timer", () => {
  it("renders mm:ss from endsAt", () => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      render(<Timer endsAt={1_000_000 + 90_000} />); // 90s
      expect(screen.getByRole("timer").textContent).toBe("1:30");
    } finally {
      spy.mockRestore();
    }
  });

  it("uses the danger colour under 10s", () => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      render(<Timer endsAt={1_000_000 + 8_000} />); // 8s
      expect(screen.getByRole("timer").className).toContain("text-imposter");
    } finally {
      spy.mockRestore();
    }
  });

  it("renders nothing without endsAt", () => {
    const { container } = render(<Timer />);
    expect(container.firstChild).toBeNull();
  });

  it("clamps to 0:00 past the deadline", () => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(2_000_000);
    try {
      render(<Timer endsAt={1_000_000} />);
      expect(screen.getByRole("timer").textContent).toBe("0:00");
    } finally {
      spy.mockRestore();
    }
  });
});
