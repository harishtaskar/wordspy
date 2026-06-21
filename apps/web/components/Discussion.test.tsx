import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { DEFAULT_ROOM_SETTINGS, type RoomSummary } from "@wordspy/types";
import { Discussion } from "./Discussion";
import { useChatStore } from "@/store/chat";
import { useConnectionStore } from "@/store/connection";

const emit = vi.fn();
vi.mock("@/lib/socket", () => ({ getSocket: () => ({ emit }) }));

beforeEach(() => {
  emit.mockReset();
  useChatStore.setState({ messages: [] });
  useConnectionStore.setState({ status: "connected", socketId: "p2", protocolVersion: 1 });
});
afterEach(cleanup);

const room: RoomSummary = {
  code: "ABCDE",
  phase: "discussion",
  round: 1,
  votesCast: 0,
  revote: false,
  phaseEndsAt: 1_000_000 + 60_000,
  settings: DEFAULT_ROOM_SETTINGS,
  hostId: "host",
  players: [
    { id: "host", username: "Aanya", isHost: true, isReady: false, isEliminated: false, score: 0, colorIndex: 0 },
    { id: "p2", username: "Rex", isHost: false, isReady: false, isEliminated: false, score: 0, colorIndex: 0 },
  ],
};

describe("Discussion", () => {
  it("shows round, category and the timer", () => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      render(<Discussion room={room} />);
      expect(screen.getByText(/round 1/i)).toBeTruthy();
      expect(screen.getByText(/food/i)).toBeTruthy();
      expect(screen.getByRole("timer").textContent).toBe("1:00");
    } finally {
      spy.mockRestore();
    }
  });

  it("renders chat messages from the store with names", () => {
    useChatStore.setState({
      messages: [
        { playerId: "host", username: "Aanya", text: "Best when shared.", ts: 1 },
        { playerId: "p2", username: "Rex", text: "Comes in a box.", ts: 2 },
      ],
    });
    render(<Discussion room={room} />);
    // Scope to the chat feed — the roster aside also lists player names.
    const feed = within(screen.getByLabelText(/discussion chat/i));
    expect(feed.getByText("Best when shared.")).toBeTruthy();
    expect(feed.getByText("Comes in a box.")).toBeTruthy();
    expect(feed.getByText("Aanya")).toBeTruthy(); // other sender label
    expect(feed.getByText(/Rex \(You\)/)).toBeTruthy(); // p2 (me) label
  });

  it("emits chat:send on send and clears the input", () => {
    render(<Discussion room={room} />);
    const input = screen.getByLabelText(/message/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  Popular on weekends  " } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(emit).toHaveBeenCalledWith("chat:send", { code: "ABCDE", text: "Popular on weekends" });
    expect(input.value).toBe("");
  });

  it("does not send an empty message", () => {
    render(<Discussion room={room} />);
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(emit).not.toHaveBeenCalled();
  });

  it("shows a spectator banner and hides the input when eliminated", () => {
    const eliminatedRoom: RoomSummary = {
      ...room,
      players: [
        { id: "host", username: "Aanya", isHost: true, isReady: false, isEliminated: false, score: 0, colorIndex: 0 },
        { id: "p2", username: "Rex", isHost: false, isReady: false, isEliminated: true, score: 0, colorIndex: 0 },
      ],
    };
    useChatStore.setState({
      messages: [{ playerId: "host", username: "Aanya", text: "Still here.", ts: 1 }],
    });
    render(<Discussion room={eliminatedRoom} />); // me = p2 (eliminated)
    expect(screen.getByText(/spectating/i)).toBeTruthy();
    expect(screen.queryByLabelText(/message/i)).toBeNull();
    expect(screen.getByText("Still here.")).toBeTruthy(); // feed still visible
  });
});
