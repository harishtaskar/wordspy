import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DEFAULT_ROOM_SETTINGS, type RoomSummary } from "@wordspy/types";
import { Voting } from "./Voting";
import { useConnectionStore } from "@/store/connection";

const emit = vi.fn();
vi.mock("@/lib/socket", () => ({ getSocket: () => ({ emit }) }));

beforeEach(() => {
  emit.mockReset();
  useConnectionStore.setState({ status: "connected", socketId: "p2", protocolVersion: 1 });
});
afterEach(cleanup);

const room: RoomSummary = {
  code: "ABCDE",
  phase: "voting",
  round: 1,
  votesCast: 1,
  revote: false,
  settings: DEFAULT_ROOM_SETTINGS,
  hostId: "host",
  players: [
    { id: "host", username: "Aanya", isHost: true, isReady: false, isEliminated: false, score: 0, colorIndex: 0 },
    { id: "p2", username: "Rex", isHost: false, isReady: false, isEliminated: false, score: 0, colorIndex: 0 },
    { id: "p3", username: "Mo", isHost: false, isReady: false, isEliminated: false, score: 0, colorIndex: 0 },
  ],
};

describe("Voting", () => {
  it("lists active players except me and shows live progress", () => {
    render(<Voting room={room} />); // me = p2
    expect(screen.getByRole("button", { name: /aanya/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^mo/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^rex/i })).toBeNull(); // not self
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("requires a selection before submit", () => {
    render(<Voting room={room} />);
    expect((screen.getByRole("button", { name: /submit vote/i }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /aanya/i }));
    expect((screen.getByRole("button", { name: /submit vote/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("emits vote:cast and locks after a successful submit", () => {
    emit.mockImplementation((_e, _req, cb) => cb({ ok: true, data: room }));
    render(<Voting room={room} />);
    fireEvent.click(screen.getByRole("button", { name: /aanya/i }));
    fireEvent.click(screen.getByRole("button", { name: /submit vote/i }));
    expect(emit).toHaveBeenCalledWith("vote:cast", { code: "ABCDE", targetId: "host" }, expect.any(Function));
    expect(screen.getByText(/vote locked/i)).toBeTruthy();
  });

  it("excludes eliminated players as targets", () => {
    const r: RoomSummary = {
      ...room,
      players: room.players.map((p) => (p.id === "p3" ? { ...p, isEliminated: true, score: 0, colorIndex: 0 } : p)),
    };
    render(<Voting room={r} />);
    expect(screen.queryByRole("button", { name: /^mo/i })).toBeNull();
  });

  it("shows the re-vote banner and is unlocked when a re-vote opens", () => {
    const revoteRoom: RoomSummary = { ...room, revote: true, votesCast: 0 };
    render(<Voting room={revoteRoom} />);
    expect(screen.getByText(/tied — vote again/i)).toBeTruthy();
    // Unlocked: the Submit button is present (not the "Vote locked" state).
    expect(screen.getByRole("button", { name: /submit vote/i })).toBeTruthy();
    expect(screen.queryByText(/vote locked/i)).toBeNull();
  });

  it("shows spectator state for an eliminated voter", () => {
    useConnectionStore.setState({ status: "connected", socketId: "p2", protocolVersion: 1 });
    const r: RoomSummary = {
      ...room,
      players: room.players.map((p) => (p.id === "p2" ? { ...p, isEliminated: true, score: 0, colorIndex: 0 } : p)),
    };
    render(<Voting room={r} />);
    expect(screen.getByText(/spectating/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /submit vote/i })).toBeNull();
  });
});
