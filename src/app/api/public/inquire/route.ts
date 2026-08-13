import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startVapiCall } from "@/lib/vapi";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// The ONE public, unauthenticated endpoint in this project — a stand-in for a
// real business's own "contact us" form. Anyone can hit this, so it's built
// safe-by-default: it always creates the lead, but only ever places a real
// call when the submitted number is on an explicit allowlist you control via
// DEMO_CALL_ALLOWED_NUMBERS. No allowlist configured = no auto-calling,
// full stop — this is opt-in, not opt-out. That's deliberate: without it,
// this endpoint would let a stranger make your system dial any phone number
// in the world.

function normalizePhone(phone: string) {
  return phone.replace(/[\s\-()]/g, "");
}

function allowedNumbers(): string[] {
  return (process.env.DEMO_CALL_ALLOWED_NUMBERS ?? "")
    .split(",")
    .map((n) => normalizePhone(n.trim()))
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  // Tight limit — this endpoint is public and can trigger real calls.
  const { ok, retryAfterMs } = rateLimit(`inquire:${clientIp(req)}`, 3, 10 * 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests — please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs ?? 0) / 1000)) } },
    );
  }

  try {
    const body = await req.json();
    const { name, phone, notes } = body as { name?: string; phone?: string; notes?: string };

    if (!name || !phone) {
      return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
    }

    const lead = await db.lead.create({ data: { name, phone, notes } });

    const agentId = process.env.DEMO_AGENT_ID || "seed-agent-demo";
    const agent = await db.agent.findUnique({ where: { id: agentId } });

    // The web-call handoff (below) works regardless of phone setup — it's
    // WebRTC in the same browser, not a PSTN call — so it's always offered
    // when the demo agent exists and is synced. Real phone auto-dial stays
    // gated behind the allowlist, same as before.
    const webCall = agent?.vapiAssistantId
      ? { assistantId: agent.vapiAssistantId, agentName: agent.name }
      : null;

    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    const phoneEligible =
      agent?.vapiAssistantId && phoneNumberId && allowedNumbers().includes(normalizePhone(phone));

    if (!phoneEligible) {
      return NextResponse.json({ lead, called: false, webCall });
    }

    try {
      const vapiCall = await startVapiCall(agent.vapiAssistantId!, phoneNumberId!, lead.phone);
      await db.call.create({
        data: { agentId: agent!.id, leadId: lead.id, vapiCallId: vapiCall.id, status: "in_progress" },
      });
      await db.lead.update({ where: { id: lead.id }, data: { status: "called" } });
      return NextResponse.json({ lead, called: true, agentName: agent!.name, webCall });
    } catch (err) {
      // The lead is already saved either way — a failed call attempt
      // shouldn't look like the whole submission failed to the customer.
      console.error("Auto-call from /api/public/inquire failed:", err);
      return NextResponse.json({ lead, called: false, webCall });
    }
  } catch (err) {
    console.error("POST /api/public/inquire failed:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
