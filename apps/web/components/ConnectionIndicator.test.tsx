import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConnectionIndicator } from "./ConnectionIndicator";
import { useConnectionStore } from "@/store/connection";

afterEach(cleanup);

describe("ConnectionIndicator", () => {
  it("shows CONNECTING by default", () => {
    useConnectionStore.setState({ status: "connecting" });
    render(<ConnectionIndicator />);
    expect(screen.getByRole("status").textContent).toMatch(/CONNECTING/);
  });

  it("reflects connected state from the store", () => {
    useConnectionStore.setState({ status: "connected" });
    render(<ConnectionIndicator />);
    expect(screen.getByRole("status").textContent).toBe("CONNECTED");
  });

  it("reflects disconnected state from the store", () => {
    useConnectionStore.setState({ status: "disconnected" });
    render(<ConnectionIndicator />);
    expect(screen.getByRole("status").textContent).toBe("DISCONNECTED");
  });
});
