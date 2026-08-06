import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sonnet is plenty for turning a chat message into a structured tool call —
// no need to pay for Opus here.
export const BUILDER_MODEL = "claude-sonnet-5";

// The "meta" tool: Claude doesn't edit the voice assistant directly, it calls
// this tool and we apply the result to our Agent record + push it to Vapi.
export const UPDATE_AGENT_CONFIG_TOOL: Anthropic.Tool = {
  name: "update_agent_config",
  description:
    "Create or update the configuration of the voice AI assistant being designed in this conversation. " +
    "Call this every time the user's request changes what the assistant should say, ask, or do — even small " +
    "tweaks. Always pass the full, current value for every field (not a diff): read back what's already " +
    "configured (given to you in the system prompt) and only change what the user asked to change.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Short human-readable name for the assistant, e.g. 'Sunset Realty Lead Qualifier'.",
      },
      firstMessage: {
        type: "string",
        description: "The exact greeting the assistant says first when a lead picks up. Natural spoken language.",
      },
      systemPrompt: {
        type: "string",
        description:
          "Full instructions for the voice assistant, written as direct second-person instructions to it: " +
          "its persona and tone, the qualification questions it must ask (in order) to learn the lead's budget, " +
          "timeline, and location/property preferences, how to handle objections or hesitation, and the booking " +
          "flow: once the lead seems interested in meeting, call check_availability, read 2-3 of the returned " +
          "options out loud, and once the lead picks one, call book_meeting with that exact slot's ISO timestamp.",
      },
      qualificationCriteria: {
        type: "array",
        items: { type: "string" },
        description:
          "Short bullet list of the specific facts the assistant must learn about each lead, e.g. " +
          "['budget range', 'move-in timeline', 'preferred neighborhood', 'buying or selling'].",
      },
    },
    required: ["name", "firstMessage", "systemPrompt", "qualificationCriteria"],
  },
};

export function builderSystemPrompt(currentConfig: {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  qualificationCriteria: unknown;
}) {
  return `You are the "builder agent" inside a platform that lets a real-estate professional design a voice AI \
assistant just by chatting with you in plain language. That voice assistant (built by Vapi) will actually call \
leads, qualify them against criteria, and book meetings — your job is only to design/edit its configuration by \
calling the update_agent_config tool, and to reply conversationally about what you set up.

Ground rules:
- On every user message that implies any change (new agent, tweak the script, change the voice/persona, add a \
question, change tone, etc.), call update_agent_config with the complete, updated configuration.
- If this is the very first message and the config is still empty, invent sensible defaults from what the user \
described rather than asking a lot of clarifying questions first — get something working, then refine.
- Keep firstMessage short, warm, and natural to say out loud.
- Keep systemPrompt as clear operating instructions for the *voice* assistant itself (it will literally be given \
this text as its own system prompt), not a description aimed at the user.
- After calling the tool, also reply with a short, friendly chat message (1-3 sentences) summarizing what you \
changed, as if talking to the person building the agent.
- If the user asks something unrelated to configuring the assistant, just answer normally without calling the tool.

Current configuration (empty strings/arrays mean nothing has been set yet):
${JSON.stringify(currentConfig, null, 2)}`;
}

export type QualificationResult = {
  qualified: boolean;
  summary: string;
  budget: string;
  timeline: string;
  locationPreference: string;
};

// Runs once per finished call (from the end-of-call-report webhook) to turn the
// raw transcript into the structured summary shown on the calls dashboard.
export async function extractQualification(transcript: string): Promise<QualificationResult> {
  const response = await anthropic.messages.create({
    model: BUILDER_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Read this real-estate lead-qualification call transcript and extract the outcome.\n\nTranscript:\n${transcript}`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            qualified: {
              type: "boolean",
              description: "Whether this lead is a genuine, qualified buyer/seller worth following up with.",
            },
            summary: { type: "string", description: "One or two sentence summary of how the call went." },
            budget: { type: "string", description: "The lead's stated budget, or 'unknown' if never discussed." },
            timeline: { type: "string", description: "The lead's stated timeline, or 'unknown'." },
            locationPreference: { type: "string", description: "Preferred neighborhood/area, or 'unknown'." },
          },
          required: ["qualified", "summary", "budget", "timeline", "locationPreference"],
          additionalProperties: false,
        },
      },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return JSON.parse(textBlock && "text" in textBlock ? textBlock.text : "{}") as QualificationResult;
}
