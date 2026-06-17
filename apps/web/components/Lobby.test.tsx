import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DEFAULT_ROOM_SETTINGS, type RoomSummary } from "@wordspy/types";
import { Lobby } from "./Lobby";
import { useConnectionStore } from "@/store/connection";
import { useRoomStore } from "@/store/room";

const emit = vi.fn();
vi.mock("@/lib/socket", () => ({ getSocket: () => ({ emit }) }));
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => {
  emit.mockReset();
  replace.mockReset();
  useConnectionStore.setState({ status: "connected", socketId: "p2", protocolVersion: 1 });
  useRoomStore.setState({ room: { ...room } });
});
afterEach(cleanup);

const room: RoomSummary = {
  code: "ABCDE",
  phase: "lobby",
  round: 1,
  votesCast: 0,
  revote: false,
  settings: DEFAULT_ROOM_SETTINGS,
  hostId: "host",
  players: [
    { id: "host", username: "Aanya", isHost: true, isReady: true, isEliminated: false, score: 0 },
    { id: "p2", username: "Rex", isHost: false, isReady: false, isEliminated: false, score: 0 },
  ],
};

describe("Lobby", () => {
  it("renders all players with host badge and ready state", () => {
    render(<Lobby room={room} />);
    expect(screen.getByText("Aanya")).toBeTruthy();
    expect(screen.getByText(/Rex/)).toBeTruthy();
    expect(screen.getByText("Host")).toBeTruthy();
    expect(screen.getByText(/Ready/)).toBeTruthy(); // Aanya ready
    expect(screen.getByText("2 / 8")).toBeTruthy();
  });

  it("marks the current player with (you)", () => {
    render(<Lobby room={room} />);
    expect(screen.getByText(/Rex \(you\)/)).toBeTruthy();
  });

  it("emits room:setReady when toggling", () => {
    render(<Lobby room={room} />);
    fireEvent.click(screen.getByRole("button", { name: /i'm ready/i }));
    expect(emit).toHaveBeenCalledWith(
      "room:setReady",
      { code: "ABCDE", ready: true },
      expect.any(Function),
    );
  });

  it("shows kick buttons + Start only to the host", () => {
    // me = host
    useConnectionStore.setState({ status: "connected", socketId: "host", protocolVersion: 1 });
    const three: RoomSummary = {
      ...room,
      players: [
        { id: "host", username: "Aanya", isHost: true, isReady: false, isEliminated: false, score: 0 },
        { id: "p2", username: "Rex", isHost: false, isReady: false, isEliminated: false, score: 0 },
        { id: "p3", username: "Mo", isHost: false, isReady: false, isEliminated: false, score: 0 },
      ],
    };
    render(<Lobby room={three} />);
    expect(screen.getByRole("button", { name: /kick rex/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /kick aanya/i })).toBeNull(); // not self
    const start = screen.getByRole("button", { name: /start game/i }) as HTMLButtonElement;
    expect(start.disabled).toBe(false);
  });

  it("disables Start under quorum and emits start when clicked", () => {
    useConnectionStore.setState({ status: "connected", socketId: "host", protocolVersion: 1 });
    const two: RoomSummary = {
      ...room,
      players: [
        { id: "host", username: "Aanya", isHost: true, isReady: false, isEliminated: false, score: 0 },
        { id: "p2", username: "Rex", isHost: false, isReady: false, isEliminated: false, score: 0 },
      ],
    };
    const { rerender } = render(<Lobby room={two} />);
    expect((screen.getByRole("button", { name: /start game/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/need 3\+ to start/i)).toBeTruthy();

    const three: RoomSummary = {
      ...two,
      players: [...two.players, { id: "p3", username: "Mo", isHost: false, isReady: false, isEliminated: false, score: 0 }],
    };
    rerender(<Lobby room={three} />);
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(emit).toHaveBeenCalledWith("room:start", { code: "ABCDE" }, expect.any(Function));
  });

  it("does not show host controls to a non-host", () => {
    useConnectionStore.setState({ status: "connected", socketId: "p2", protocolVersion: 1 });
    render(<Lobby room={room} />);
    expect(screen.queryByRole("button", { name: /start game/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /kick/i })).toBeNull();
  });

  it("renders the starting placeholder when phase is starting", () => {
    render(<Lobby room={{ ...room, phase: "role-reveal" }} />);
    expect(screen.getByText(/game starting/i)).toBeTruthy();
  });

  it("emits room:leave and navigates to Landing on Leave", () => {
    render(<Lobby room={room} />);
    fireEvent.click(screen.getByRole("button", { name: /leave room/i }));
    expect(emit).toHaveBeenCalledWith("room:leave", { code: "ABCDE" });
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows the host-now notice when host migrates to me", () => {
    const { rerender } = render(<Lobby room={room} />);
    expect(screen.queryByText(/host now/i)).toBeNull();
    const migrated: RoomSummary = {
      ...room,
      hostId: "p2",
      players: [{ id: "p2", username: "Rex", isHost: true, isReady: false, isEliminated: false, score: 0 }],
    };
    rerender(<Lobby room={migrated} />);
    expect(screen.getByText(/host now/i)).toBeTruthy();
  });
});
