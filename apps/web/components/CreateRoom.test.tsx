import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { DEFAULT_ROOM_SETTINGS, type RoomSummary } from "@wordspy/types";
import { CreateRoom } from "./CreateRoom";
import { usePlayerSession } from "@/store/session";
import { useRoomStore } from "@/store/room";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const emit = vi.fn();
vi.mock("@/lib/socket", () => ({ getSocket: () => ({ emit, on: vi.fn(), off: vi.fn() }) }));

beforeEach(() => {
  replace.mockReset();
  emit.mockReset();
  usePlayerSession.setState({ sessionId: "s1", username: "Aanya" });
  useRoomStore.setState({ room: null });
});
afterEach(cleanup);

describe("CreateRoom", () => {
  it("redirects to Landing when username is invalid", () => {
    usePlayerSession.setState({ sessionId: "s1", username: "" });
    render(<CreateRoom />);
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("emits room:create and shows the code on success", async () => {
    const room: RoomSummary = {
      code: "ABCDE",
      phase: "lobby",
      round: 1,
      votesCast: 0,
      revote: false,
      settings: DEFAULT_ROOM_SETTINGS,
      hostId: "s1",
      players: [{ id: "s1", username: "Aanya", isHost: true, isReady: false, isEliminated: false, score: 0, colorIndex: 0 }],
    };
    emit.mockImplementation((_event, _req, cb) => cb({ ok: true, data: room }));

    render(<CreateRoom />);
    fireEvent.click(screen.getByRole("button", { name: /create room/i }));

    expect(emit).toHaveBeenCalledWith(
      "room:create",
      expect.objectContaining({ username: "Aanya", settings: DEFAULT_ROOM_SETTINGS, sessionId: expect.any(String) }),
      expect.any(Function),
    );
    await waitFor(() => expect(screen.getByText("ABCDE")).toBeTruthy());
  });

  it("shows an error when the server rejects", async () => {
    emit.mockImplementation((_event, _req, cb) => cb({ ok: false, error: "Room full." }));
    render(<CreateRoom />);
    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Room full."));
  });

  it("updates a setting when an option is picked", () => {
    render(<CreateRoom />);
    const moviesBtn = screen.getByRole("button", { name: /^movies$/i });
    fireEvent.click(moviesBtn);
    expect(moviesBtn.getAttribute("aria-pressed")).toBe("true");
  });
});
