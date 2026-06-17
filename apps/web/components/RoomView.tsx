"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomSummary, RolePayload, ChatMessage } from "@wordspy/types";
import { Button } from "./Button";
import { getSocket } from "@/lib/socket";
import { useRoomStore } from "@/store/room";
import { useRoleStore } from "@/store/role";
import { useChatStore } from "@/store/chat";
import { Lobby } from "./Lobby";
import { RoleReveal } from "./RoleReveal";
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

  // --- Role reveal phase ---------------------------------------------------
  if (liveRoom.phase === "role-reveal") {
    if (role && !revealDone) {
      return (
        <section className="flex flex-col gap-4">
          <RoleReveal role={role} onDone={() => setRevealDone(true)} />
        </section>
      );
    }
    return (
      <section className="border-[3px] border-ink bg-surface p-[14px] text-center shadow-[var(--shadow-card)]">
        <p
          className="text-[20px] uppercase leading-none tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {role ? "Get ready…" : "Assigning roles…"}
        </p>
        <p className="mt-2 text-[13px] text-muted">Discussion starting…</p>
      </section>
    );
  }

  // --- Discussion phase ----------------------------------------------------
  if (liveRoom.phase === "discussion") {
    return (
      <section className="flex flex-col gap-4">
        <Discussion room={liveRoom} />
      </section>
    );
  }

  // --- Voting phase --------------------------------------------------------
  if (liveRoom.phase === "voting") {
    return (
      <section className="flex flex-col gap-4">
        <Voting room={liveRoom} />
      </section>
    );
  }

  // --- Result phase --------------------------------------------------------
  if (liveRoom.phase === "result") {
    return (
      <section className="flex flex-col gap-4">
        <VoteResultReveal room={liveRoom} />
      </section>
    );
  }

  // --- Final guess ---------------------------------------------------------
  if (liveRoom.phase === "final-guess") {
    return (
      <section className="flex flex-col gap-4">
        <FinalGuess room={liveRoom} />
      </section>
    );
  }

  // --- Game over -----------------------------------------------------------
  if (liveRoom.phase === "game-over") {
    return (
      <section className="flex flex-col gap-4">
        <WinnerReveal room={liveRoom} />
      </section>
    );
  }

  // --- Lobby phase ---------------------------------------------------------
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join?room=${room.code}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
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
