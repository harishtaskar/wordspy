import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Settings } from "./Settings";
import { useSettings } from "@/store/settings";

beforeEach(() => {
  useSettings.setState({ soundEnabled: true, reducedMotion: false });
});
afterEach(cleanup);

describe("Settings", () => {
  it("reflects store defaults", () => {
    render(<Settings onClose={() => {}} />);
    const sound = screen.getByRole("switch", { name: /sound effects/i });
    const motion = screen.getByRole("switch", { name: /reduced motion/i });
    expect(sound.getAttribute("aria-checked")).toBe("true");
    expect(motion.getAttribute("aria-checked")).toBe("false");
  });

  it("toggling sound updates the store", () => {
    render(<Settings onClose={() => {}} />);
    fireEvent.click(screen.getByRole("switch", { name: /sound effects/i }));
    expect(useSettings.getState().soundEnabled).toBe(false);
  });

  it("toggling reduced motion updates the store", () => {
    render(<Settings onClose={() => {}} />);
    fireEvent.click(screen.getByRole("switch", { name: /reduced motion/i }));
    expect(useSettings.getState().reducedMotion).toBe(true);
  });

  it("closes via Done and via Escape", () => {
    const onClose = vi.fn();
    render(<Settings onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
