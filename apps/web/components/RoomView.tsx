"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { RoomSummary, RolePayload, ChatMessage } from "@wordspy/types";
import { Button } from "./Button";
import { getSocket } from "@/lib/socket";
import { useConnectionStore } from "@/store/connection";
import { useRoomStore } from "@/store/room";
import { useRoleStore } from "@/store/role";
import { useChatStore } from "@/store/chat";
import { Lobby } from "./Lobby";
import { RoleReveal } from "./RoleReveal";
import { RoleBanner } from "./RoleBanner";
import { Discussion } from "./Discussion";
import { Voting } from "./Voting";
import { VoteResultReveal } from "./VoteResultReveal";
import { FinalGuess } from "./FinalGuess";
import { WinnerReveal } from "./WinnerReveal";

/** Room shell: lobby (code/share + roster) or, once started, the role reveal. */
export function RoomView({ room }: { room: RoomSummary }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const setRoom = useRoomStore((s) => s.setRoom);
  const clearRoom = useRoomStore((s) => s.clearRoom);
  const liveRoom = useRoomStore((s) => s.room) ?? room;
  const role = useRoleStore((s) => s.role);
  const setRole = useRoleStore((s) => s.setRole);
  const clearRole = useRoleStore((s) => s.clearRole);
  const addMessage = useChatStore((s) => s.addMessage);
  const clearChat = useChatStore((s) => s.clear);
  const myId = useConnectionStore((s) => s.socketId);
  // A player who joined mid-match: watch-only this match, plays the next one.
  const isSpectator = liveRoom.players.find((p) => p.id === myId)?.isSpectator ?? false;

  // Server-authoritative updates: roster/phase, our secret role, chat, kicks.
  useEffect(() => {
    const socket = getSocket();
    const onState = (next: RoomSummary) => {
      if (next.code === room.code) setRoom(next);
    };
    const onRole = (payload: RolePayload) => setRole(payload);
    const onChat = (msg: ChatMessage) => addMessage(msg);
    const onKicked = (payload: { code: string }) => {
      if (payload.code === room.code) {
        clearRoom();
        clearRole();
        clearChat();
        router.replace("/?kicked=1");
      }
    };
    socket.on("room:state", onState);
    socket.on("game:role", onRole);
    socket.on("chat:message", onChat);
    socket.on("room:kicked", onKicked);
    return () => {
      socket.off("room:state", onState);
      socket.off("game:role", onRole);
      socket.off("chat:message", onChat);
      socket.off("room:kicked", onKicked);
    };
  }, [room.code, setRoom, setRole, addMessage, clearRoom, clearRole, clearChat, router]);

  // After a rematch the room returns to lobby — drop last match's secrets/chat.
  useEffect(() => {
    if (liveRoom.phase === "lobby") {
      clearRole();
      clearChat();
      setRevealDone(false);
    }
  }, [liveRoom.phase, clearRole, clearChat]);

  // Leave the room at any time — including mid-match (server frees the seat and
  // resolves the round if a vote was pending).
  const leaveGame = () => {
    getSocket().emit("room:leave", { code: room.code });
    clearRoom();
    clearRole();
    clearChat();
    router.replace("/");
  };

  // Wrap an in-game phase with a persistent "Leave game" control.
  const withLeave = (node: ReactNode) => (
    <section className="flex flex-col gap-4">
      {node}
      <button
        type="button"
        onClick={leaveGame}
        className="min-h-[44px] text-[12px] font-bold uppercase tracking-[1.5px] text-muted underline underline-offset-4 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
      >
        Leave game
      </button>
    </section>
  );

  // --- Role reveal phase ---------------------------------------------------
  if (liveRoom.phase === "role-reveal") {
    if (isSpectator) {
      return withLeave(
        <section className="border-[3px] border-ink bg-surface p-[14px] text-center shadow-[var(--shadow-card)]">
          <p
            className="text-[20px] uppercase leading-none tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Spectating
          </p>
          <p className="mt-2 text-[13px] text-muted">A match is in progress. You&apos;ll play next round.</p>
        </section>,
      );
    }
    if (role && !revealDone) {
      return withLeave(<RoleReveal role={role} onDone={() => setRevealDone(true)} />);
    }
    return withLeave(
      <section className="border-[3px] border-ink bg-surface p-[14px] text-center shadow-[var(--shadow-card)]">
        <p
          className="text-[20px] uppercase leading-none tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {role ? "Get ready…" : "Assigning roles…"}
        </p>
        <p className="mt-2 text-[13px] text-muted">Discussion starting…</p>
      </section>,
    );
  }

  // --- Discussion phase ----------------------------------------------------
  if (liveRoom.phase === "discussion") {
    return withLeave(
      <>
        {role && <RoleBanner role={role} />}
        <Discussion room={liveRoom} />
      </>,
    );
  }

  // --- Voting phase --------------------------------------------------------
  if (liveRoom.phase === "voting") {
    return withLeave(
      <>
        {role && <RoleBanner role={role} />}
        <Voting room={liveRoom} />
      </>,
    );
  }

  // --- Result phase --------------------------------------------------------
  if (liveRoom.phase === "result") {
    return withLeave(<VoteResultReveal room={liveRoom} />);
  }

  // --- Final guess ---------------------------------------------------------
  if (liveRoom.phase === "final-guess") {
    return withLeave(<FinalGuess room={liveRoom} />);
  }

  // --- Game over -----------------------------------------------------------
  if (liveRoom.phase === "game-over") {
    return withLeave(<WinnerReveal room={liveRoom} />);
  }

  // --- Lobby phase ---------------------------------------------------------
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join?room=${room.code}` : "";

  const copy = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // Fallback for non-secure contexts (LAN IP, older browsers).
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="border-[3px] border-ink bg-surface p-[14px] text-center shadow-[var(--shadow-hero)]">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">Room code</p>
        <p
          className="mt-1 text-[40px] uppercase leading-none tracking-[4px] text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {room.code}
        </p>
      </div>

      <div className="border-[3px] border-ink bg-surface p-[14px] shadow-[var(--shadow-card)]">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">Share link</p>
        <p className="mt-1 break-all text-[12px]">{shareUrl}</p>
        <Button variant="primary" className="mt-3 w-full" onClick={copy}>
          {copied ? "Copied ✓" : "Copy link"}
        </Button>
      </div>

      <Lobby room={liveRoom} />
    </section>
  );
}
