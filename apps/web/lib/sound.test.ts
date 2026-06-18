import { describe, it, expect } from "vitest";
import { sound, playSfx } from "./sound";

// jsdom has no AudioContext — the engine must degrade to harmless no-ops
// rather than throw, so audio never breaks gameplay on unsupported runtimes.
describe("sound engine (no AudioContext)", () => {
  it("never throws when triggered without Web Audio support", () => {
    expect(() => {
      sound.setSfxEnabled(false);
      sound.setMusicEnabled(false);
      sound.setSfxEnabled(true);
      sound.setMusicEnabled(true);
      sound.resume();
      playSfx("click");
      playSfx("win");
      sound.startMusic();
      sound.stopMusic();
    }).not.toThrow();
  });
});
