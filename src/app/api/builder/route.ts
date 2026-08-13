import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropic, BUILDER_MODEL, UPDATE_AGENT_CONFIG_TOOL, builderSystemPrompt } from "@/lib/claude";
import { upsertVapiAssistant } from "@/lib/vapi";
import { rateLimit, clientIp } from "@/lib/rate-limit";

type AgentConfigPatch = {
  name?: string;
  firstMessage?: string;
  systemPrompt?: string;
  qualificationCriteria?: string[];
  voiceId?: string;
};

export async function POST(req: NextRequest) {
  // Each turn costs a real Anthropic call (and often a Vapi sync too) — 20/min
  // per IP is generous for a real conversation but stops a runaway retry loop
  // or casual abuse from burning through API credits.
  const { ok, retryAfterMs } = rateLimit(`builder:${clientIp(req)}`, 20, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests — slow down a little and try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs ?? 0) / 1000)) } },
    );
  }

  try {
    return await handleBuilderMessage(req);
  } catch (err) {
    // Without this, an unhandled error (bad DB connection, missing/invalid
    // ANTHROPIC_API_KEY, etc.) crashes the function with an empty response body,
    // which shows up client-side as a confusing "Unexpected end of JSON input".
    console.error("POST /api/builder failed:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleBuilderMessage(req: NextRequest) {
  const body = await req.json();
  const { agentId, message } = body as { agentId?: string; message: string };

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const agent = agentId
    ? await db.agent.findUnique({ where: { id: agentId }, include: { messages: { orderBy: { createdAt: "asc" } } } })
    : await db.agent.create({ data: {}, include: { messages: true } });

  if (!agent) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }

  await db.builderMessage.create({ data: { agentId: agent.id, role: "user", content: message } });

  const history = agent.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const currentConfig = {
    name: agent.name,
    firstMessage: agent.firstMessage,
    systemPrompt: agent.systemPrompt,
    qualificationCriteria: agent.qualificationCriteria,
    voiceId: agent.voiceId,
  };

  const response = await anthropic.messages.create({
    model: BUILDER_MODEL,
    max_tokens: 4096,
    system: builderSystemPrompt(currentConfig),
    tools: [UPDATE_AGENT_CONFIG_TOOL],
    messages: [...history, { role: "user", content: message }],
  });

  let replyText = "";
  let configPatch: AgentConfigPatch | null = null;

  for (const block of response.content) {
    if (block.type === "text") {
      replyText += block.text;
    } else if (block.type === "tool_use" && block.name === "update_agent_config") {
      configPatch = block.input as AgentConfigPatch;
    }
  }

  let updatedAgent = agent;
  let vapiError: string | null = null;

  if (configPatch) {
    updatedAgent = await db.agent.update({
      where: { id: agent.id },
      data: {
        name: configPatch.name ?? agent.name,
        firstMessage: configPatch.firstMessage ?? agent.firstMessage,
        systemPrompt: configPatch.systemPrompt ?? agent.systemPrompt,
        qualificationCriteria: configPatch.qualificationCriteria ?? (agent.qualificationCriteria as string[]),
        voiceId: configPatch.voiceId ?? agent.voiceId,
      },
      include: { messages: true },
    });

    try {
      const vapiAssistant = await upsertVapiAssistant(
        {
          name: updatedAgent.name,
          firstMessage: updatedAgent.firstMessage,
          systemPrompt: updatedAgent.systemPrompt,
          voiceId: updatedAgent.voiceId,
        },
        updatedAgent.vapiAssistantId,
      );
      if (vapiAssistant.id !== updatedAgent.vapiAssistantId) {
        updatedAgent = await db.agent.update({
          where: { id: updatedAgent.id },
          data: { vapiAssistantId: vapiAssistant.id },
          include: { messages: true },
        });
      }
    } catch (err) {
      vapiError = err instanceof Error ? err.message : "Failed to sync with Vapi";
    }
  }

  if (!replyText) {
    replyText = configPatch ? "Done — I've updated the assistant." : "Got it.";
  }

  await db.builderMessage.create({ data: { agentId: updatedAgent.id, role: "assistant", content: replyText } });

  return NextResponse.json({ agent: updatedAgent, reply: replyText, vapiError });
}

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    const agents = await db.agent.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ agents });
  }
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ agent });
}
