import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Landing } from "./Landing";
import { usePlayerSession } from "@/store/session";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockReset();
  usePlayerSession.setState({ sessionId: null, username: "" });
});
afterEach(cleanup);

describe("Landing", () => {
  it("disables Create/Join until the username is valid", () => {
    render(<Landing />);
    const create = screen.getByRole("button", { name: /create room/i }) as HTMLButtonElement;
    const join = screen.getByRole("button", { name: /join room/i }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    expect(join.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Aanya" } });
    expect(create.disabled).toBe(false);
    expect(join.disabled).toBe(false);
  });

  it("navigates to /create with a valid name and persists it", () => {
    render(<Landing />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "  Rex  " } });
    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(push).toHaveBeenCalledWith("/create");
    expect(usePlayerSession.getState().username).toBe("Rex");
  });

  it("shows an error after blur on an invalid name", () => {
    render(<Landing />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "A" } });
    fireEvent.blur(screen.getByLabelText(/your name/i));
    expect(screen.getByRole("alert").textContent).toMatch(/at least 2/i);
  });

  it("opens and closes How To Play", () => {
    render(<Landing />);
    fireEvent.click(screen.getByRole("button", { name: /how to play/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("assigns an ephemeral session id on mount", () => {
    render(<Landing />);
    expect(usePlayerSession.getState().sessionId).toBeTruthy();
  });
});
