# AI Voice Agent Builder

A platform where you chat with an AI "builder" that designs a voice AI assistant in
plain language — for any outbound-calling use case, not just one industry. The
generated assistant then calls contacts, qualifies them against whatever criteria fit
that use case, offers real open slots from a calendar, and books a real meeting once
the contact picks one. The example used throughout this README is a real estate lead
qualifier, but the builder chat works the same way for a SaaS demo booker, a
recruiting screener, or anything else you describe to it.

This README is both the setup guide and a description of how the pieces fit together —
written for someone who has never built anything like this before.

## What "the app" actually is

Three things working together:

1. **This Next.js app** (what you're looking at) — the UI, the database, and the
   "builder agent" logic that turns a chat message into a voice-assistant config.
2. **Vapi** — a hosted voice AI platform. It owns speech-to-text, the real-time LLM
   turn-taking during a call, text-to-speech, and telephony. We never touch audio
   directly; we just tell Vapi's API what assistant to run, and Vapi calls us back
   (via webhook) when it needs something from us mid-call.
3. **Cal.com** — a real calendar. When the assistant offers times and books a meeting,
   it's checking and reserving an actual slot, not writing to a spreadsheet.

```
┌─────────────┐      chat       ┌──────────────────┐   tool call    ┌────────────┐
│   Builder    │ ───────────────▶│  Claude (builder  │───────────────▶│  Our API   │
│  Chat UI     │◀─────────────── │  agent) via API   │◀─────────────── │  (Next.js) │
└─────────────┘  updated config  └──────────────────┘  saved config   └─────┬──────┘
                                                                              │ create/update assistant
                                                                              ▼
                                                                        ┌──────────┐
                                                                        │  Vapi.ai │
                                                                        │Assistant │
                                                                        └────┬─────┘
                          outbound call / web call                          │
        ┌─────────────────────────────────────────────────────────────────┘
        ▼
┌───────────────┐  check_availability / book_meeting ┌────────────┐  book slot   ┌─────────┐
│  Lead (phone   │────────────────────────────────────▶│  Our API   │─────────────▶│ Cal.com │
│  or browser)   │   end-of-call-report (transcript)  │  webhook   │               └─────────┘
└───────────────┘────────────────────────────────────▶│            │
                                                        └─────┬──────┘
                                                              ▼
                                                        ┌────────────┐
                                                        │  Postgres  │
                                                        │ (Supabase) │
                                                        └────────────┘
```

## The four screens

- **`/builder`** — chat with Claude to describe/edit the assistant. A live preview
  card shows the generated config, and once it's synced to Vapi you can click
  **"Call in browser"** to actually talk to it with your microphone — no phone
  number needed.
- **`/leads`** — add leads (name + phone) and trigger a real outbound phone call to
  one, using whichever agent you pick from the dropdown.
- **`/calls`** — every call that's happened (web test calls and real outbound calls),
  with its transcript, an AI-extracted qualification summary, and the booked meeting
  time if one was made.

## Accounts you need

Create these, then paste the resulting keys into `.env` (copy `.env.example` first —
see below). None of them need to be paid; every one has a free tier that's enough for
building and demoing this.

| # | Service | What it's for | Where |
|---|---|---|---|
| 1 | **Anthropic** | The "builder agent" that turns chat into assistant configs, and the qualification-summary extractor | [console.anthropic.com](https://console.anthropic.com) → sign up → Settings → Billing (add a few dollars of credit) → Settings → API Keys → Create Key |
| 2 | **Vapi** | The voice engine — speech-to-text, real-time LLM, text-to-speech, telephony | [dashboard.vapi.ai](https://dashboard.vapi.ai) → sign up (comes with free trial credit) → Org Settings → API Keys (grab both the **private** and **public** key) |
| 3 | **Supabase** | Free hosted Postgres database | [supabase.com](https://supabase.com) → sign up → New Project → once ready, click the **Connect** button at the top of the project page → **ORMs** tab → **Prisma** → copy both `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) |
| 4 | **Cal.com** | Real calendar the assistant books into | [cal.com](https://cal.com) → sign up → create **one Event Type** (e.g. "Property Viewing", 30 min) → Settings → Developer → API Keys → create a key (starts with `cal_`). Its numeric **Event Type ID** is in the event type's URL/settings. |
| 5 | **GitHub** | Source control + what Vercel deploys from | [github.com](https://github.com) → sign up → New Repository |
| 6 | **Vercel** | Hosting — also gives Vapi's webhooks a public URL to call | [vercel.com](https://vercel.com) → sign up with GitHub → Import the repo |

You do **not** need separate ElevenLabs or Deepgram accounts — Vapi includes voice and
speech-to-text through its own credits by default.

### Getting a Vapi phone number (only needed for real outbound calls)

The browser "Call in browser" button works with zero phone setup. If you also want to
call a real phone number from `/leads`, go to Vapi's dashboard → Phone Numbers →
provision a free trial number, then copy its ID into `VAPI_PHONE_NUMBER_ID` in `.env`.

### Custom voices (ElevenLabs)

Every generated assistant already speaks through ElevenLabs — Vapi calls it under the
hood (`voice: { provider: "11labs", voiceId }` in `src/lib/vapi.ts`) using Vapi's own
shared account, billed through your Vapi credits. No separate ElevenLabs account
needed for the default voice.

Two ways to use a different voice:

- **Pick another public ElevenLabs voice** — copy any voice ID from
  [ElevenLabs' voice library](https://elevenlabs.io/voice-library) (or from Vapi's own
  assistant editor, which has a voice picker) and just tell the builder chat
  *"use voice ID `<id>`"*. The `update_agent_config` tool (see `src/lib/claude.ts`)
  accepts an explicit `voiceId` — Claude is instructed to only set it when given a
  concrete ID, never to guess one from a vague description like "a friendly voice."
- **Use your own ElevenLabs account** (e.g. a cloned/custom voice) — sign up at
  [elevenlabs.io](https://elevenlabs.io), grab an API key, then in Vapi's dashboard go
  to **Org Settings → Provider Keys** and add it there. Once validated, any voice ID
  from your own ElevenLabs account (including cloned voices) can be used the same way
  — no code change needed, since our app never talks to ElevenLabs directly; Vapi does.

## Environment variables

```bash
cp .env.example .env
```

Then fill in every value in `.env` using the accounts above. Each variable in
`.env.example` has a comment saying exactly where to find it. `.env` is gitignored —
never commit it.

## Running it locally

```bash
npm install          # already run once during setup, safe to re-run
npm run db:migrate    # creates the tables in your Supabase database
npm run db:seed       # sample leads + a demo agent + a couple of illustrative calls
npm run dev            # starts the app at http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) for the landing page, or jump straight to `/builder`.

### Try the golden path

1. **`/builder`**: type something like *"Build me an assistant that calls real estate
   leads, asks about budget, timeline, and preferred neighborhood, and books a viewing
   once they agree on a time."* Watch the preview card fill in and a matching
   assistant appear in your [Vapi dashboard](https://dashboard.vapi.ai).
2. Click **Call in browser** and actually talk to it.
3. **`/leads`**: add a lead with your own phone number, pick the agent, click **Call**
   — your phone should ring within a few seconds (only works once `VAPI_PHONE_NUMBER_ID`
   is set, and only for real phone numbers).
4. **`/calls`**: after the call ends, refresh — you'll see the transcript and an
   AI-extracted qualification summary, plus the booked meeting time if the lead agreed
   to one during the call.

### Webhooks need a public URL — even locally

Vapi calls **your server** mid-call (to check calendar availability and book meetings)
and after the call (to deliver the transcript). That means Vapi needs to reach your
machine over the internet, which `localhost` can't do on its own. Two options:

- **Deploy to Vercel first** (see below) and just develop against the deployed URL —
  simplest for a beginner.
- **Or tunnel locally** with [ngrok](https://ngrok.com) (`ngrok http 3000`) or
  [Vapi's own local webhook CLI](https://docs.vapi.ai/cli/webhook), then set
  `NEXT_PUBLIC_APP_URL` in `.env` to the tunnel's `https://` URL before chatting in the
  builder (every edit re-syncs the webhook URL to Vapi automatically).

## Testing & CI

- `npm run lint` / `npm run build` run on every push via GitHub Actions
  (`.github/workflows/ci.yml`) — build-time env vars are dummy placeholders, since
  `next build` never actually calls Anthropic/Vapi/Cal.com, it just needs the
  constructors not to throw on a missing key.
- `npm run test:eval` runs a small **eval** (not a unit test) that sends fixed sample
  transcripts to the real Claude API and checks `extractQualification()` calls them
  qualified/not-qualified correctly (`tests/qualification.eval.ts`). This needs a real
  `ANTHROPIC_API_KEY` and costs a few cents per run, so it's intentionally excluded
  from CI — run it by hand whenever the extraction prompt changes.

## Deploying

1. Push this repo to GitHub.
2. In Vercel: **Import Project** → select the repo → in **Environment Variables**,
   paste in everything from your `.env` **except** set `NEXT_PUBLIC_APP_URL` to the
   `https://your-project.vercel.app` URL Vercel will give you (you can update this
   after the first deploy once you know the exact URL, then redeploy).
3. Deploy. Prisma's client is generated automatically on install (`postinstall` script).
4. Back in the app, edit any agent in `/builder` once — that re-syncs its Vapi webhook
   URL to point at your live Vercel URL instead of `localhost`.

## Simplifications, called out on purpose

This is a scoped build for a take-home assignment, not a production system. Worth
knowing what was deliberately left out:

- **No authentication** — it's single-tenant; anyone with the URL can use it. Adding
  real auth (e.g. Clerk or Supabase Auth) would be the first thing to add for a real
  product.
- **Qualification extraction is real-estate-specific** — the structured summary
  (`budget`, `timeline`, `locationPreference`) is hardcoded to those three fields
  rather than being fully dynamic per agent.
- **One meeting-booking flow** — the assistant always books into a single, pre-created
  Cal.com event type; a multi-agent, multi-calendar product would need to store an
  event type per agent.
- **No retry/backoff on Vapi or Cal.com calls** — a flaky network call fails visibly
  (surfaced to the user) rather than being silently retried.

## Project structure

```
prisma/schema.prisma        Data model: Agent, BuilderMessage, Lead, Call, Meeting
src/lib/claude.ts           Anthropic client, builder tool schema, qualification extraction
src/lib/vapi.ts             Vapi REST helpers: create/update assistant, place a call
src/lib/calcom.ts           Cal.com REST helpers: check availability, create a booking
src/lib/db.ts               Prisma client singleton
src/app/builder/page.tsx    Builder chat UI + live agent preview + web test call
src/app/leads/page.tsx      Leads list + outbound call trigger
src/app/calls/page.tsx      Calls dashboard: transcript + qualification + booking
src/app/api/builder/route.ts        Builder chat backend (Claude tool-use → Vapi sync)
src/app/api/calls/route.ts          Places outbound calls, lists calls
src/app/api/leads/route.ts          Lead CRUD
src/app/api/webhooks/vapi/route.ts  Handles check_availability, book_meeting, end-of-call-report
```
