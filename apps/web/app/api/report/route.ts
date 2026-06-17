import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const REPORT_TO = "harishtaskar001@gmail.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST { email, description } → emails the report via Resend. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const { email, description } = (body ?? {}) as { email?: unknown; description?: unknown };
  const from = typeof email === "string" ? email.trim() : "";
  const desc = typeof description === "string" ? description.trim() : "";
  if (!EMAIL_RE.test(from) || desc.length < 5) {
    return NextResponse.json({ ok: false, error: "Valid email + a short description required." }, { status: 400 });
  }
  if (desc.length > 2000) {
    return NextResponse.json({ ok: false, error: "Description too long." }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "Email is not configured." }, { status: 500 });
  }

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      // Use a verified domain in production; resend.dev works for the account owner.
      from: process.env.REPORT_FROM ?? "wordspy <onboarding@resend.dev>",
      to: [REPORT_TO],
      replyTo: from,
      subject: "wordspy — issue / improvement",
      text: `From: ${from}\n\n${desc}`,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: "Could not send the report." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not send the report." }, { status: 502 });
  }
}
