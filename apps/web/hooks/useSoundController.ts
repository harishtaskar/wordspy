"use client";

import { useEffect } from "react";
import { sound } from "@/lib/sound";
import { useSettings } from "@/store/settings";
import { useRoomStore } from "@/store/room";

/**
 * Bridges client preferences + game state to the audio engine. Mounted once in
 * AppShell. Resumes the (browser-suspended) audio context on the first user
 * gesture, mirrors the sound/music toggles, and loops the melody only while the
 * player is in a room.
 */
export function useSoundController(): void {
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const musicEnabled = useSettings((s) => s.musicEnabled);
  const inRoom = useRoomStore((s) => s.room !== null);

  // Honour the toggles.
  useEffect(() => {
    sound.setSfxEnabled(soundEnabled);
  }, [soundEnabled]);
  useEffect(() => {
    sound.setMusicEnabled(musicEnabled);
  }, [musicEnabled]);

  // Unlock audio on the first interaction (autoplay policy).
  useEffect(() => {
    const unlock = () => sound.resume();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Background melody plays for the duration of a room session.
  useEffect(() => {
    if (inRoom) sound.startMusic();
    else sound.stopMusic();
    return () => sound.stopMusic();
  }, [inRoom]);
}
