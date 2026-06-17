import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { InfoMenu } from "./InfoMenu";

afterEach(cleanup);

describe("InfoMenu", () => {
  it("opens the menu with Report + GitHub options", () => {
    render(<InfoMenu />);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /info menu/i }));
    expect(screen.getByRole("menuitem", { name: /report an issue/i })).toBeTruthy();
    const gh = screen.getByRole("menuitem", { name: /github/i }) as HTMLAnchorElement;
    expect(gh.getAttribute("href")).toContain("github.com/harishtaskar");
    expect(gh.getAttribute("target")).toBe("_blank");
  });

  it("opens the report modal with email + description fields", () => {
    render(<InfoMenu />);
    fireEvent.click(screen.getByRole("button", { name: /info menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /report an issue/i }));
    expect(screen.getByRole("dialog", { name: /report an issue/i })).toBeTruthy();
    expect(screen.getByLabelText(/your email/i)).toBeTruthy();
    expect(screen.getByLabelText(/issue \/ improvement/i)).toBeTruthy();
    // Send disabled until valid email + description.
    const send = screen.getByRole("button", { name: /^send$/i }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/issue \/ improvement/i), { target: { value: "it broke" } });
    expect(send.disabled).toBe(false);
  });
});
