"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { HowToPlay } from "./HowToPlay";
import { Settings } from "./Settings";
import { usePlayerSession } from "@/store/session";
import { validateUsername } from "@/lib/validateUsername";

export function Landing() {
  const router = useRouter();
  const username = usePlayerSession((s) => s.username);
  const setUsername = usePlayerSession((s) => s.setUsername);
  const ensureSession = usePlayerSession((s) => s.ensureSession);

  const [draft, setDraft] = useState(username);
  const [touched, setTouched] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    ensureSession();
  }, [ensureSession]);

  // Sync the draft when a persisted username rehydrates from sessionStorage
  // (e.g. navigating back to Landing). Doesn't fight typing — username only
  // changes on navigate, by which point draft already matches.
  useEffect(() => {
    if (username) setDraft(username);
  }, [username]);

  const result = validateUsername(draft);

  const go = (path: "/create" | "/join" | "/browse") => {
    if (!result.ok) {
      setTouched(true);
      return;
    }
    setUsername(result.value);
    router.push(path);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="border-[3px] border-ink bg-surface p-[14px] shadow-[var(--shadow-hero)]">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">
          Secret Word Agent
        </p>
        <p
          className="mt-1 text-[28px] uppercase leading-none tracking-tight text-crew"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Spot the imposter
        </p>
        <p className="mt-2 text-[13px]">Pick a name. Make a room. 3–5 minutes of chaos.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">
          Your name
        </label>
        <input
          id="username"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="e.g. Aanya"
          maxLength={24}
          autoComplete="off"
          aria-invalid={touched && !result.ok}
          aria-describedby="username-error"
          className="min-h-[44px] border-[3px] border-ink bg-surface px-3 font-bold text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
        />
        <p
          id="username-error"
          role="alert"
          className="min-h-[16px] text-[12px] font-bold text-imposter"
        >
          {touched && !result.ok ? result.error : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button variant="primary" className="w-full" disabled={!result.ok} onClick={() => go("/create")}>
          Create Room
        </Button>
        <Button variant="ghost" className="w-full" disabled={!result.ok} onClick={() => go("/join")}>
          Join Room
        </Button>
        <Button variant="ghost" className="w-full" disabled={!result.ok} onClick={() => go("/browse")}>
          Browse Public Games
        </Button>
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="min-h-[44px] text-[12px] font-bold uppercase tracking-[1.5px] text-muted underline underline-offset-4 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
          >
            How To Play
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="min-h-[44px] text-[12px] font-bold uppercase tracking-[1.5px] text-muted underline underline-offset-4 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
          >
            Settings
          </button>
        </div>
      </div>

      {showRules && <HowToPlay onClose={() => setShowRules(false)} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </section>
  );
}
