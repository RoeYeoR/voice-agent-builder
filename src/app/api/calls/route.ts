import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startVapiCall } from "@/lib/vapi";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function GET() {
  const calls = await db.call.findMany({
    orderBy: { createdAt: "desc" },
    include: { lead: true, agent: true, meetings: true },
  });
  return NextResponse.json({ calls });
}

export async function POST(req: NextRequest) {
  // This one dials a real phone — much tighter than /api/builder.
  const { ok, retryAfterMs } = rateLimit(`calls:${clientIp(req)}`, 5, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many calls started too quickly — wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs ?? 0) / 1000)) } },
    );
  }

  try {
    return await handlePlaceCall(req);
  } catch (err) {
    console.error("POST /api/calls failed:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handlePlaceCall(req: NextRequest) {
  const body = await req.json();
  const { agentId, leadId } = body as { agentId?: string; leadId?: string };

  if (!agentId || !leadId) {
    return NextResponse.json({ error: "agentId and leadId are required" }, { status: 400 });
  }

  const [agent, lead] = await Promise.all([
    db.agent.findUnique({ where: { id: agentId } }),
    db.lead.findUnique({ where: { id: leadId } }),
  ]);

  if (!agent?.vapiAssistantId) {
    return NextResponse.json({ error: "This agent hasn't synced to Vapi yet" }, { status: 400 });
  }
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    return NextResponse.json(
      { error: "VAPI_PHONE_NUMBER_ID is not set — provision a number in the Vapi dashboard first" },
      { status: 400 },
    );
  }

  const call = await db.call.create({
    data: { agentId: agent.id, leadId: lead.id, status: "queued" },
  });

  try {
    const vapiCall = await startVapiCall(agent.vapiAssistantId, phoneNumberId, lead.phone);
    const updated = await db.call.update({
      where: { id: call.id },
      data: { vapiCallId: vapiCall.id, status: "in_progress" },
    });
    await db.lead.update({ where: { id: lead.id }, data: { status: "called" } });
    return NextResponse.json({ call: updated });
  } catch (err) {
    await db.call.update({ where: { id: call.id }, data: { status: "failed" } });
    const message = err instanceof Error ? err.message : "Failed to start call";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
