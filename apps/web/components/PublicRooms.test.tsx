import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { DEFAULT_ROOM_SETTINGS, type RoomSummary } from "@wordspy/types";
import { PublicRooms } from "./PublicRooms";
import { usePlayerSession } from "@/store/session";
import { useRoomStore } from "@/store/room";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

let publicList = [
  { code: "ABCDE", hostName: "Aanya", players: 2, maxPlayers: 8, category: "world-food" as const, phase: "lobby" as const, round: 1 },
];
const joinedRoom: RoomSummary = {
  code: "ABCDE",
  phase: "lobby",
  round: 1,
  votesCast: 0,
  revote: false,
  settings: DEFAULT_ROOM_SETTINGS,
  hostId: "host",
  players: [{ id: "s1", username: "Mo", isHost: false, isReady: false, isEliminated: false, isSpectator: false, score: 0, colorIndex: 0 }],
};

const emit = vi.fn((event: string, a?: unknown, b?: unknown) => {
  if (event === "room:browseJoin") (a as (r: unknown) => void)({ ok: true, data: publicList });
  if (event === "room:join") (b as (r: unknown) => void)({ ok: true, data: joinedRoom });
});
vi.mock("@/lib/socket", () => ({ getSocket: () => ({ emit, on: vi.fn(), off: vi.fn() }) }));

beforeEach(() => {
  replace.mockReset();
  emit.mockClear(); // keep the implementation, just reset call history
  publicList = [{ code: "ABCDE", hostName: "Aanya", players: 2, maxPlayers: 8, category: "world-food", phase: "lobby", round: 1 }];
  usePlayerSession.setState({ sessionId: "s1", username: "Mo" });
  useRoomStore.setState({ room: null });
});
afterEach(cleanup);

describe("PublicRooms", () => {
  it("subscribes and renders the public room list", () => {
    render(<PublicRooms />);
    expect(emit).toHaveBeenCalledWith("room:browseJoin", expect.any(Function));
    expect(screen.getByText(/aanya's room/i)).toBeTruthy();
    expect(screen.getByText(/food · 2\/8/i)).toBeTruthy();
  });

  it("joins a room from the list → emits room:join and enters the room", async () => {
    render(<PublicRooms />);
    fireEvent.click(screen.getByRole("button", { name: /^join$/i }));
    expect(emit).toHaveBeenCalledWith(
      "room:join",
      expect.objectContaining({ code: "ABCDE", username: "Mo", sessionId: expect.any(String) }),
      expect.any(Function),
    );
    await waitFor(() => expect(screen.getByText("ABCDE")).toBeTruthy());
  });

  it("shows an empty state when there are no public games", () => {
    publicList = [];
    render(<PublicRooms />);
    expect(screen.getByText(/no public games/i)).toBeTruthy();
  });

  it("redirects to Landing without a username", () => {
    usePlayerSession.setState({ sessionId: "s1", username: "" });
    render(<PublicRooms />);
    expect(replace).toHaveBeenCalledWith("/");
  });
});
