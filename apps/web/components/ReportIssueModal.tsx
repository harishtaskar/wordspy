"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";

const REPORT_TO = "harishtaskar001@gmail.com";

function emailLooksValid(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Report-an-issue modal: collects email + description, sends via the user's mail client. */
export function ReportIssueModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [desc, setDesc] = useState("");
  const [sent, setSent] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSend = emailLooksValid(email) && desc.trim().length >= 5;

  const send = () => {
    if (!canSend) return;
    const subject = encodeURIComponent("wordspy — issue / improvement");
    const body = encodeURIComponent(`From: ${email.trim()}\n\n${desc.trim()}`);
    window.location.href = `mailto:${REPORT_TO}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report an issue"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[420px] flex-col gap-3 border-[3px] border-ink bg-surface p-[14px] shadow-[var(--shadow-hero)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[20px] uppercase leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Report an issue
        </h2>

        {sent ? (
          <>
            <p className="text-[13px] font-bold">
              Thanks! Your mail app should be open with the report — just hit send.
            </p>
            <Button ref={closeRef} variant="primary" className="w-full" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="report-email" className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">
                Your email
              </label>
              <input
                id="report-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="min-h-[44px] border-[3px] border-ink bg-surface px-3 font-bold text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="report-desc" className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">
                Issue / improvement
              </label>
              <textarea
                id="report-desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="What happened, or what would make it better?"
                className="border-[3px] border-ink bg-surface p-3 font-bold text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
              />
            </div>
            <div className="flex gap-2">
              <Button ref={closeRef} variant="ghost" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" disabled={!canSend} onClick={send}>
                Send
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
