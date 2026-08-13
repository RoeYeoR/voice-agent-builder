import "dotenv/config";
import { db } from "../src/lib/db";
import { upsertVapiAssistant } from "../src/lib/vapi";

// Illustrative sample data only — no real calls happened. This exists so a
// fresh deployment (or anyone reviewing the project) sees a populated
// dashboard instead of every page being empty on first load.

async function main() {
  const [dana, omer] = await Promise.all([
    db.lead.upsert({
      where: { id: "seed-lead-dana" },
      update: {},
      create: {
        id: "seed-lead-dana",
        name: "Dana Cohen",
        phone: "+15555550101",
        email: "dana@example.com",
        notes: "Inquired about a 3BR in the north side, open house sign-up.",
        status: "called",
      },
    }),
    db.lead.upsert({
      where: { id: "seed-lead-omer" },
      update: {},
      create: {
        id: "seed-lead-omer",
        name: "Omer Levi",
        phone: "+15555550102",
        email: "omer@example.com",
        notes: "Looking to sell current apartment within 6 months.",
        status: "called",
      },
    }),
  ]);

  const agentConfig = {
    name: "Sunset Realty Lead Qualifier",
    firstMessage:
      "Hi, this is Alex from Sunset Realty — you recently reached out about a property. Do you have a couple of minutes?",
    systemPrompt:
      "You are Alex, a warm and efficient real estate lead qualifier for Sunset Realty. Learn the lead's budget " +
      "range, timeline, and preferred neighborhood, then, once they seem interested, call check_availability, " +
      "read 2-3 real open slots aloud, and once they pick one, call book_meeting with that exact ISO timestamp. " +
      "Keep the tone friendly and brief — this is a phone call, not an interview.",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    qualificationCriteria: ["budget range", "move-in timeline", "preferred neighborhood", "buying or selling"],
  };

  const agent = await db.agent.upsert({
    where: { id: "seed-agent-demo" },
    update: {},
    create: { id: "seed-agent-demo", ...agentConfig },
  });

  // Best-effort real Vapi sync — only if keys are configured. Never fakes a
  // "Synced" status: if this fails or isn't configured, the agent just shows
  // as not-yet-synced, same as any agent you'd build by hand in the chat.
  if (process.env.VAPI_API_KEY && !agent.vapiAssistantId) {
    try {
      const vapiAssistant = await upsertVapiAssistant(
        { name: agentConfig.name, firstMessage: agentConfig.firstMessage, systemPrompt: agentConfig.systemPrompt, voiceId: agentConfig.voiceId },
        null,
      );
      await db.agent.update({ where: { id: agent.id }, data: { vapiAssistantId: vapiAssistant.id } });
      console.log("Synced demo agent to a real Vapi assistant.");
    } catch (err) {
      console.warn("Could not sync demo agent to Vapi (non-fatal):", err instanceof Error ? err.message : err);
    }
  }

  const qualifiedCall = await db.call.upsert({
    where: { id: "seed-call-dana" },
    update: {},
    create: {
      id: "seed-call-dana",
      agentId: agent.id,
      leadId: dana.id,
      status: "ended",
      transcript:
        "Assistant: Hi, this is Alex from Sunset Realty — you recently reached out about a property. Do you have a couple of minutes?\n" +
        "Dana: Sure, I have a few minutes.\n" +
        "Assistant: Great — what's your budget range for the new place?\n" +
        "Dana: Somewhere between six hundred and seven hundred thousand.\n" +
        "Assistant: And when are you hoping to move?\n" +
        "Dana: Ideally within the next two to three months.\n" +
        "Assistant: Any particular neighborhood in mind?\n" +
        "Dana: The north side, close to the new school.\n" +
        "Assistant: I have a viewing slot Thursday at 4pm or Friday at 10am — which works better?\n" +
        "Dana: Thursday at 4 works great.\n" +
        "Assistant: Booked for Thursday at 4pm — looking forward to it!",
      qualificationResult: {
        qualified: true,
        summary: "Motivated buyer with a clear budget and timeline, booked a viewing for Thursday.",
        keyDetails: ["budget: $600k-$700k", "timeline: 2-3 months", "neighborhood: north side, near schools"],
      },
    },
  });

  await db.meeting.upsert({
    where: { id: "seed-meeting-dana" },
    update: {},
    create: {
      id: "seed-meeting-dana",
      callId: qualifiedCall.id,
      leadId: dana.id,
      scheduledAt: (() => {
        const d = new Date();
        d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7)); // next Thursday
        d.setHours(16, 0, 0, 0);
        return d;
      })(),
      status: "booked",
    },
  });

  await db.call.upsert({
    where: { id: "seed-call-omer" },
    update: {},
    create: {
      id: "seed-call-omer",
      agentId: agent.id,
      leadId: omer.id,
      status: "ended",
      transcript:
        "Assistant: Hi, this is Alex from Sunset Realty — you mentioned you might be selling soon. Got a minute?\n" +
        "Omer: Actually I'm just exploring the idea, nothing concrete yet.\n" +
        "Assistant: Understood — no pressure. When you do have a timeline in mind, what's driving the move?\n" +
        "Omer: Honestly not sure yet, just keeping an eye on the market for now.\n" +
        "Assistant: No problem — I'll follow up in a few months. Have a great day!",
      qualificationResult: {
        qualified: false,
        summary: "Not actively selling yet — just gauging the market. Worth a follow-up later.",
        keyDetails: ["timeline: unknown", "intent: exploratory only"],
      },
    },
  });
}

main()
  .then(async () => {
    console.log("Seeded sample leads, a demo agent, and two illustrative calls.");
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
