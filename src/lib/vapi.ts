// Thin wrapper around Vapi's REST API (https://docs.vapi.ai).
// Vapi is the "voice engine": it owns speech-to-text, the realtime LLM turn-taking,
// text-to-speech, and telephony. We just tell it what assistant to run.

const VAPI_BASE_URL = "https://api.vapi.ai";

export type AgentConfig = {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  voiceId: string;
};

// Two tools every generated assistant gets, both handled by our webhook
// (src/app/api/webhooks/vapi/route.ts): the assistant first checks what's
// really open on the calendar, offers a couple of options out loud, then
// books whichever one the contact picks. Deliberately domain-agnostic — the
// same two tools serve a real estate viewing, a sales demo, a recruiting
// screen call, or anything else the builder chat generates.
const CHECK_AVAILABILITY_TOOL = {
  type: "function",
  function: {
    name: "check_availability",
    description:
      "Look up real open slots on the calendar so you can offer the contact 2-3 concrete options to choose from. Call this before offering any specific time.",
    parameters: { type: "object", properties: {} },
  },
} as const;

const BOOK_MEETING_TOOL = {
  type: "function",
  function: {
    name: "book_meeting",
    description:
      "Reserve a meeting. Only call this after the contact has explicitly picked one of the exact slot times returned by check_availability — reuse that ISO timestamp exactly.",
    parameters: {
      type: "object",
      properties: {
        leadName: { type: "string", description: "The contact's full name." },
        startTime: {
          type: "string",
          description: "The exact ISO 8601 timestamp of the chosen slot, copied from check_availability's output.",
        },
        notes: {
          type: "string",
          description: "Anything useful to bring into the meeting: what they're interested in, key qualifying facts, etc.",
        },
      },
      required: ["leadName", "startTime"],
    },
  },
} as const;

function vapiHeaders() {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) throw new Error("VAPI_API_KEY is not set in .env");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function buildAssistantPayload(config: AgentConfig) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    name: config.name,
    firstMessage: config.firstMessage,
    model: {
      provider: "anthropic",
      // The model that runs *inside* the live call (Vapi's realtime brain), separate
      // from BUILDER_MODEL in claude.ts. Vapi maintains its own allowlist of Anthropic
      // models, which can lag behind Anthropic's latest releases — if assistant
      // creation fails with a "model not supported" error, check Vapi's dashboard
      // (Assistant > Model > Anthropic) for the current list and update VAPI_MODEL.
      model: process.env.VAPI_MODEL || "claude-sonnet-4-5-20250929",
      messages: [{ role: "system", content: config.systemPrompt }],
      tools: [CHECK_AVAILABILITY_TOOL, BOOK_MEETING_TOOL],
    },
    voice: {
      provider: "11labs",
      voiceId: config.voiceId,
    },
    server: {
      url: `${appUrl}/api/webhooks/vapi`,
      secret: process.env.VAPI_WEBHOOK_SECRET,
    },
  };
}

// Creates the assistant on Vapi the first time (no existingId), or patches it
// in place on every later edit so the same assistant just evolves.
export async function upsertVapiAssistant(config: AgentConfig, existingId?: string | null) {
  const payload = buildAssistantPayload(config);
  const url = existingId ? `${VAPI_BASE_URL}/assistant/${existingId}` : `${VAPI_BASE_URL}/assistant`;
  const method = existingId ? "PATCH" : "POST";

  const res = await fetch(url, { method, headers: vapiHeaders(), body: JSON.stringify(payload) });
  if (!res.ok) {
    throw new Error(`Vapi ${method} ${url} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{ id: string }>;
}

// Places a real outbound PSTN call from our Vapi phone number to a lead.
export async function startVapiCall(assistantId: string, phoneNumberId: string, customerNumber: string) {
  const res = await fetch(`${VAPI_BASE_URL}/call`, {
    method: "POST",
    headers: vapiHeaders(),
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: { number: customerNumber },
    }),
  });
  if (!res.ok) {
    throw new Error(`Vapi call failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{ id: string }>;
}
