import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DEFAULT_ROOM_SETTINGS, type RoomSummary } from "@wordspy/types";
import { FinalGuess } from "./FinalGuess";
import { useRoleStore } from "@/store/role";

const emit = vi.fn();
vi.mock("@/lib/socket", () => ({ getSocket: () => ({ emit }) }));

beforeEach(() => {
  emit.mockReset();
  useRoleStore.setState({ role: null });
});
afterEach(cleanup);

const room: RoomSummary = {
  code: "ABCDE",
  phase: "final-guess",
  round: 1,
  votesCast: 0,
  revote: false,
  phaseEndsAt: Date.now() + 20_000,
  settings: DEFAULT_ROOM_SETTINGS,
  hostId: "host",
  players: [],
};

describe("FinalGuess", () => {
  it("imposter sees an input and emits guess:submit", () => {
    useRoleStore.setState({ role: { role: "imposter", category: "world-food" } });
    render(<FinalGuess room={room} />);
    const input = screen.getByLabelText(/final guess/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Pizza" } });
    fireEvent.click(screen.getByRole("button", { name: /lock in guess/i }));
    expect(emit).toHaveBeenCalledWith(
      "guess:submit",
      { code: "ABCDE", word: "Pizza" },
      expect.any(Function),
    );
  });

  it("crew sees the waiting state, no input", () => {
    useRoleStore.setState({ role: { role: "crew", word: "Pizza", category: "world-food" } });
    render(<FinalGuess room={room} />);
    expect(screen.getByText(/they're guessing/i)).toBeTruthy();
    expect(screen.queryByLabelText(/final guess/i)).toBeNull();
  });
});
