import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { DEFAULT_ROOM_SETTINGS, type RoomSummary } from "@wordspy/types";
import { JoinRoom } from "./JoinRoom";
import { usePlayerSession } from "@/store/session";
import { useRoomStore } from "@/store/room";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => search,
}));

const emit = vi.fn();
vi.mock("@/lib/socket", () => ({ getSocket: () => ({ emit, on: vi.fn(), off: vi.fn() }) }));

beforeEach(() => {
  replace.mockReset();
  emit.mockReset();
  search = new URLSearchParams();
  usePlayerSession.setState({ sessionId: "s1", username: "Rex" });
  useRoomStore.setState({ room: null });
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
    { id: "host", username: "Aanya", isHost: true, isReady: false, isEliminated: false, score: 0, colorIndex: 0 },
    { id: "s1", username: "Rex", isHost: false, isReady: false, isEliminated: false, score: 0, colorIndex: 0 },
  ],
};

describe("JoinRoom", () => {
  it("prefills the code from the ?room= link", () => {
    search = new URLSearchParams("room=abcde");
    render(<JoinRoom />);
    expect((screen.getByLabelText(/room code/i) as HTMLInputElement).value).toBe("ABCDE");
  });

  it("disables Join until the code is 5 chars", () => {
    render(<JoinRoom />);
    const btn = screen.getByRole("button", { name: /join ▸|joining/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/room code/i), { target: { value: "ABCDE" } });
    expect(btn.disabled).toBe(false);
  });

  it("emits room:join and shows the room on success", async () => {
    emit.mockImplementation((_e, _req, cb) => cb({ ok: true, data: room }));
    render(<JoinRoom />);
    fireEvent.change(screen.getByLabelText(/room code/i), { target: { value: "ABCDE" } });
    fireEvent.click(screen.getByRole("button", { name: /join ▸/i }));
    expect(emit).toHaveBeenCalledWith(
      "room:join",
      expect.objectContaining({ code: "ABCDE", username: "Rex", sessionId: expect.any(String) }),
      expect.any(Function),
    );
    await waitFor(() => expect(screen.getByText("ABCDE")).toBeTruthy());
  });

  it("shows an error when the join is rejected", async () => {
    emit.mockImplementation((_e, _req, cb) => cb({ ok: false, error: "Room full." }));
    render(<JoinRoom />);
    fireEvent.change(screen.getByLabelText(/room code/i), { target: { value: "ABCDE" } });
    fireEvent.click(screen.getByRole("button", { name: /join ▸/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Room full."));
  });

  it("lets a fresh visitor set a name inline (share-link flow) without losing the code", () => {
    usePlayerSession.setState({ sessionId: "s1", username: "" });
    search = new URLSearchParams("room=ABCDE");
    render(<JoinRoom />);
    // No redirect — the name field is shown and the code is kept.
    expect(replace).not.toHaveBeenCalled();
    const nameInput = screen.getByLabelText(/your name/i) as HTMLInputElement;
    expect((screen.getByLabelText(/room code/i) as HTMLInputElement).value).toBe("ABCDE");
    const btn = screen.getByRole("button", { name: /join ▸/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true); // no name yet
    fireEvent.change(nameInput, { target: { value: "Mo" } });
    expect(btn.disabled).toBe(false);
  });

  it("emits the inline-entered name on join", () => {
    usePlayerSession.setState({ sessionId: "s1", username: "" });
    search = new URLSearchParams("room=ABCDE");
    emit.mockImplementation((_e, _req, cb) => cb({ ok: true, data: room }));
    render(<JoinRoom />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Mo" } });
    fireEvent.click(screen.getByRole("button", { name: /join ▸/i }));
    expect(emit).toHaveBeenCalledWith(
      "room:join",
      { code: "ABCDE", username: "Mo", sessionId: "s1" },
      expect.any(Function),
    );
  });
});
