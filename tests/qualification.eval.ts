// An "eval", not a unit test: it makes real calls to the Anthropic API to
// score extractQualification()'s output against fixed sample transcripts.
// Needs a real ANTHROPIC_API_KEY and costs a few cents to run, so it's
// deliberately NOT part of `npm run build`/CI — run it manually with
// `npm run test:eval` whenever the extraction prompt changes.
import "dotenv/config";
import { describe, it, expect } from "vitest";
import { extractQualification } from "../src/lib/claude";

const cases = [
  {
    name: "clearly qualified real estate buyer",
    transcript:
      "Assistant: Hi, this is Alex from Sunset Realty. What's your budget range?\n" +
      "Lead: Somewhere between six hundred and seven hundred thousand.\n" +
      "Assistant: And your timeline?\n" +
      "Lead: Within the next two months, ideally.\n" +
      "Assistant: Great, I have Thursday at 4pm open for a viewing — does that work?\n" +
      "Lead: Yes, that works.",
    expectQualified: true,
  },
  {
    name: "clearly not interested",
    transcript:
      "Assistant: Hi, this is Alex from Sunset Realty, following up on your inquiry.\n" +
      "Lead: Sorry, I'm not interested anymore, please remove me from your list.\n" +
      "Assistant: No problem, I'll take you off the list. Have a good day.",
    expectQualified: false,
  },
  {
    name: "exploratory, no concrete plan",
    transcript:
      "Assistant: Hi, this is Alex, following up about selling your apartment.\n" +
      "Lead: I'm just exploring the idea, nothing concrete yet, no timeline.\n" +
      "Assistant: Understood, I'll check back in a few months.",
    expectQualified: false,
  },
];

describe("extractQualification (eval)", () => {
  it.each(cases)("$name", async ({ transcript, expectQualified }) => {
    const result = await extractQualification(transcript);
    expect(result.qualified).toBe(expectQualified);
    expect(result.summary.length).toBeGreaterThan(0);
    expect(Array.isArray(result.keyDetails)).toBe(true);
  }, 30_000);
});
