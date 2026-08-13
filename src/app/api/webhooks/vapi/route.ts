import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractQualification } from "@/lib/claude";
import { getAvailableSlots, createBooking } from "@/lib/calcom";

// Single endpoint Vapi calls for everything that happens during/after a call:
// mid-call tool invocations (check_availability, book_meeting) and the final
// end-of-call-report with the transcript. Configured as the assistant's
// `server.url` in src/lib/vapi.ts.

type ToolCall = { id: string; name: string; arguments?: unknown; parameters?: unknown };

function verifySecret(req: NextRequest) {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  const provided = req.headers.get("x-vapi-secret");
  return !expected || expected === provided;
}

function formatSlotLabel(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

async function handleCheckAvailability() {
  const slots = await getAvailableSlots();
  const options = slots.slice(0, 3);
  if (options.length === 0) {
    return "No open slots in the next two weeks — apologize and offer to have someone follow up by phone.";
  }
  return options.map((s) => `${formatSlotLabel(s.start)} (${s.start})`).join("; ");
}

async function handleBookMeeting(vapiCallId: string | undefined, args: Record<string, unknown>) {
  const leadName = String(args.leadName ?? "the lead");
  const startTime = String(args.startTime ?? "");
  if (!startTime) return "Missing a chosen time — ask the lead to pick one of the offered slots first.";

  const call = vapiCallId
    ? await db.call.findFirst({ where: { vapiCallId }, include: { lead: true } })
    : null;

  const booking = await createBooking(startTime, {
    name: leadName,
    email: call?.lead?.email || "lead@example.com",
  });

  if (call) {
    await db.meeting.create({
      data: {
        callId: call.id,
        leadId: call.leadId!,
        calcomBookingId: booking.uid,
        scheduledAt: new Date(booking.start),
      },
    });
  }

  return `Booked for ${formatSlotLabel(booking.start)}. Confirm this out loud with the lead.`;
}

async function handleToolCalls(message: {
  call?: { id?: string };
  toolCallList?: ToolCall[];
}) {
  const results = [];
  for (const call of message.toolCallList ?? []) {
    const args = (call.arguments ?? call.parameters ?? {}) as Record<string, unknown>;
    let result: string;
    try {
      if (call.name === "check_availability") {
        result = await handleCheckAvailability();
      } else if (call.name === "book_meeting") {
        result = await handleBookMeeting(message.call?.id, args);
      } else {
        result = `Unknown tool: ${call.name}`;
      }
    } catch (err) {
      result = `Sorry, something went wrong booking that: ${err instanceof Error ? err.message : "unknown error"}`;
    }
    results.push({ toolCallId: call.id, name: call.name, result });
  }
  return NextResponse.json({ results });
}

async function handleEndOfCallReport(message: {
  call?: { id?: string; assistantId?: string };
  artifact?: { transcript?: string; recording?: { stereoUrl?: string; monoUrl?: string } };
}) {
  const vapiCallId = message.call?.id;
  const transcript = message.artifact?.transcript ?? "";
  const recordingUrl = message.artifact?.recording?.stereoUrl ?? message.artifact?.recording?.monoUrl ?? null;

  let call = vapiCallId ? await db.call.findFirst({ where: { vapiCallId } }) : null;

  if (!call && vapiCallId && message.call?.assistantId) {
    const agent = await db.agent.findFirst({ where: { vapiAssistantId: message.call.assistantId } });
    if (agent) {
      call = await db.call.create({ data: { agentId: agent.id, vapiCallId, status: "ended" } });
    }
  }
  if (!call) return NextResponse.json({ ok: true });

  let qualificationResult = null;
  if (transcript) {
    try {
      qualificationResult = await extractQualification(transcript);
    } catch {
      qualificationResult = null;
    }
  }

  await db.call.update({
    where: { id: call.id },
    data: {
      status: "ended",
      transcript,
      qualificationResult: qualificationResult ?? undefined,
      recordingUrl: recordingUrl ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  const body = await req.json();
  const message = body.message ?? {};

  if (message.type === "tool-calls") {
    return handleToolCalls(message);
  }
  if (message.type === "end-of-call-report") {
    return handleEndOfCallReport(message);
  }

  return NextResponse.json({ ok: true });
}
