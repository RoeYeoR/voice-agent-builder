import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropic, BUILDER_MODEL, UPDATE_AGENT_CONFIG_TOOL, builderSystemPrompt } from "@/lib/claude";
import { upsertVapiAssistant } from "@/lib/vapi";

type AgentConfigPatch = {
  name?: string;
  firstMessage?: string;
  systemPrompt?: string;
  qualificationCriteria?: string[];
};

export async function POST(req: NextRequest) {
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
