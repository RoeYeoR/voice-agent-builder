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
        description: "Short human-readable name for the assistant, e.g. 'Enterprise Demo Booker'.",
      },
      firstMessage: {
        type: "string",
        description: "The exact greeting the assistant says first when a contact picks up. Natural spoken language.",
      },
      systemPrompt: {
        type: "string",
        description:
          "Full instructions for the voice assistant, written as direct second-person instructions to it: " +
          "its persona and tone, the specific questions it must ask (in order) to qualify the contact for " +
          "whatever this agent's purpose is, how to handle objections or hesitation, and the booking flow: " +
          "once the contact seems interested in meeting, call check_availability, read 2-3 of the returned " +
          "options out loud, and once they pick one, call book_meeting with that exact slot's ISO timestamp.",
      },
      qualificationCriteria: {
        type: "array",
        items: { type: "string" },
        description:
          "Short bullet list of the specific facts the assistant must learn about each contact, tailored to " +
          "whatever this agent is for — e.g. ['budget range', 'move-in timeline'] for a real estate agent, " +
          "['team size', 'current tool'] for a SaaS demo booker, ['years of experience', 'notice period'] for " +
          "a recruiting screener.",
      },
      voiceId: {
        type: "string",
        description:
          "An ElevenLabs voice ID to use for this assistant. Only set this if the user gives you an exact " +
          "voice ID (their own or a custom/cloned one) or explicitly asks to change the voice and you already " +
          "know a valid ID for what they want — never invent or guess a voice ID from a vague description like " +
          "'a friendly voice'. Leave unset to keep whatever voice is already configured.",
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
  voiceId: string;
}) {
  return `You are the "builder agent" inside a platform that lets someone design a voice AI assistant for any \
outbound-calling use case — sales, real estate, recruiting, customer renewals, appointment reminders, event \
follow-ups, anything — just by chatting with you in plain language. That voice assistant (built by Vapi) will \
actually call contacts, qualify them against whatever criteria fit this specific use case, and book meetings — \
your job is only to design/edit its configuration by calling the update_agent_config tool, and to reply \
conversationally about what you set up.

Ground rules:
- On every user message that implies any change (new agent, tweak the script, change the voice/persona, add a \
question, change tone, etc.), call update_agent_config with the complete, updated configuration.
- If this is the very first message and the config is still empty, invent sensible defaults from what the user \
described rather than asking a lot of clarifying questions first — get something working, then refine. Infer the \
domain and vocabulary entirely from what the user says; don't assume any particular industry.
- Keep firstMessage short, warm, and natural to say out loud.
- Keep systemPrompt as clear operating instructions for the *voice* assistant itself (it will literally be given \
this text as its own system prompt), not a description aimed at the user.
- Only touch voiceId when the user gives you a concrete voice ID or clearly asks for a voice change you can \
resolve to one — see the tool's voiceId description for why guessing is off-limits.
- After calling the tool, also reply with a short, friendly chat message (1-3 sentences) summarizing what you \
changed, as if talking to the person building the agent.
- If the user asks something unrelated to configuring the assistant, just answer normally without calling the tool.

Current configuration (empty strings/arrays mean nothing has been set yet):
${JSON.stringify(currentConfig, null, 2)}`;
}

export type QualificationResult = {
  qualified: boolean;
  summary: string;
  keyDetails: string[];
};

// Runs once per finished call (from the end-of-call-report webhook) to turn the
// raw transcript into the structured summary shown on the calls dashboard. Kept
// domain-agnostic (unlike the fixed real-estate fields an earlier version used)
// since agents built on this platform can be for any use case.
export async function extractQualification(transcript: string): Promise<QualificationResult> {
  const response = await anthropic.messages.create({
    model: BUILDER_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Read this call transcript and extract the outcome. The assistant's exact purpose and \
qualification criteria are whatever the transcript itself implies — infer them from context.\n\nTranscript:\n${transcript}`,
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
              description: "Whether this contact is a genuine, qualified prospect worth following up with.",
            },
            summary: { type: "string", description: "One or two sentence summary of how the call went." },
            keyDetails: {
              type: "array",
              items: { type: "string" },
              description:
                "The key facts learned about the contact, each as a short 'label: value' string, e.g. " +
                "'budget: $500k-$700k' or 'team size: 40 engineers'. Empty array if nothing concrete came up.",
            },
          },
          required: ["qualified", "summary", "keyDetails"],
          additionalProperties: false,
        },
      },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return JSON.parse(textBlock && "text" in textBlock ? textBlock.text : "{}") as QualificationResult;
}
