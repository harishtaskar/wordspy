import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DEFAULT_ROOM_SETTINGS, type RoomSummary, type VoteResult } from "@wordspy/types";
import { VoteResultReveal } from "./VoteResultReveal";

afterEach(cleanup);

function roomWith(result: VoteResult | undefined): RoomSummary {
  return {
    code: "ABCDE",
    phase: "result",
    round: 1,
    votesCast: 3,
    revote: false,
    voteResult: result,
    settings: DEFAULT_ROOM_SETTINGS,
    hostId: "host",
    players: [],
  };
}

const tally = [
  { playerId: "p2", username: "Rex", count: 2 },
  { playerId: "host", username: "Aanya", count: 1 },
];

describe("VoteResultReveal", () => {
  it("shows a caught Crew suspect with counts", () => {
    render(
      <VoteResultReveal
        room={roomWith({ round: 1, suspectId: "p2", suspectUsername: "Rex", wasImposter: false, tie: false, tally })}
      />,
    );
    expect(screen.getAllByText("Rex").length).toBeGreaterThan(0); // hero + tally row
    expect(screen.getByText(/was crew/i)).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy(); // count shown
    expect(screen.getByText(/round 1 result/i)).toBeTruthy();
  });

  it("shows the imposter outcome", () => {
    render(
      <VoteResultReveal
        room={roomWith({ round: 1, suspectId: "p2", suspectUsername: "Rex", wasImposter: true, tie: false, tally })}
      />,
    );
    expect(screen.getByText(/was the imposter/i)).toBeTruthy();
  });

  it("shows a tie", () => {
    render(
      <VoteResultReveal
        room={roomWith({ round: 1, suspectId: null, suspectUsername: null, wasImposter: false, tie: true, tally: [] })}
      />,
    );
    expect(screen.getByText(/tie — nobody out/i)).toBeTruthy();
  });

  it("falls back when no result is present", () => {
    render(<VoteResultReveal room={roomWith(undefined)} />);
    expect(screen.getByText(/resolving/i)).toBeTruthy();
  });
});
