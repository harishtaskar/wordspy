import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DEFAULT_ROOM_SETTINGS, type RoomSummary } from "@wordspy/types";
import { WinnerReveal } from "./WinnerReveal";
import { useConnectionStore } from "@/store/connection";

const emit = vi.fn();
vi.mock("@/lib/socket", () => ({ getSocket: () => ({ emit }) }));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

beforeEach(() => {
  emit.mockReset();
  useConnectionStore.setState({ status: "connected", socketId: "host", protocolVersion: 1 });
});
afterEach(cleanup);

const room: RoomSummary = {
  code: "ABCDE",
  phase: "game-over",
  round: 1,
  votesCast: 0,
  revote: false,
  winner: "crew",
  revealedWord: "PIZZA",
  revealedImposter: "Rex",
  settings: DEFAULT_ROOM_SETTINGS,
  hostId: "host",
  players: [
    { id: "host", username: "Aanya", isHost: true, isReady: false, isEliminated: false, score: 270, colorIndex: 0 },
    { id: "p2", username: "Rex", isHost: false, isReady: false, isEliminated: false, score: 0, colorIndex: 0 },
    { id: "p3", username: "Mo", isHost: false, isReady: false, isEliminated: false, score: 170, colorIndex: 0 },
  ],
};

describe("WinnerReveal", () => {
  it("shows winner, word, imposter and scores", () => {
    render(<WinnerReveal room={room} />);
    expect(screen.getByText(/crew wins/i)).toBeTruthy();
    expect(screen.getByText("PIZZA")).toBeTruthy();
    expect(screen.getAllByText("Rex").length).toBeGreaterThan(0); // imposter card + scoreboard
    expect(screen.getByText("+270")).toBeTruthy();
    expect(screen.getByText("+170")).toBeTruthy();
  });

  it("ranks scores descending (top scorer first)", () => {
    render(<WinnerReveal room={room} />);
    const scores = screen.getAllByText(/^\+\d+$/).map((n) => n.textContent);
    expect(scores).toEqual(["+270", "+170", "+0"]);
  });

  it("shows IMPOSTER WINS for an imposter win", () => {
    render(<WinnerReveal room={{ ...room, winner: "imposter" }} />);
    expect(screen.getByText(/imposter wins/i)).toBeTruthy();
  });

  it("host can Continue → emits room:playAgain", () => {
    render(<WinnerReveal room={room} />); // me = host
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(emit).toHaveBeenCalledWith("room:playAgain", { code: "ABCDE" }, expect.any(Function));
  });

  it("host can open Change Settings; non-host sees a waiting note", () => {
    render(<WinnerReveal room={room} />); // host
    expect(screen.getByRole("button", { name: /change settings/i })).toBeTruthy();

    cleanup();
    useConnectionStore.setState({ status: "connected", socketId: "p2", protocolVersion: 1 });
    render(<WinnerReveal room={room} />);
    expect(screen.queryByRole("button", { name: /continue/i })).toBeNull();
    expect(screen.getByText(/waiting for the host/i)).toBeTruthy();
  });
});
