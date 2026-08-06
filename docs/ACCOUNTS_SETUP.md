# Account setup — step by step

Detailed, click-by-click instructions for every account this project needs. Do them
in this order — 1, 2, 3 first (needed to run the app locally), 4 before you test
booking, 5 and 6 only when you're ready to deploy.

General rule for every service below: **never share a full API key** (screenshot,
Slack message, commit) — treat it like a password. If one leaks, go back to that
service and revoke/regenerate it immediately.

---

## 1. Anthropic Console — the builder agent's brain

1. Go to **console.anthropic.com** and sign up (email or Google).
2. You land on the Console home / Workbench.
3. Add billing credit first — the API won't respond without it:
   - Left sidebar → **Settings** (gear icon) → **Billing**.
   - Click **Add to credit balance** (wording may say "Set up billing" if it's your
     first time).
   - Enter a card and add a small amount — **$5–10 is plenty** for building and
     demoing this project.
4. Create the API key:
   - Left sidebar → **Settings** → **API Keys** (direct URL:
     `console.anthropic.com/settings/keys`).
   - Click **Create Key**.
   - **Name it** `voice-agent-builder-dev` — naming keys by project+environment
     makes it obvious which one to revoke later if you ever rotate keys or work on
     multiple projects.
   - Click **Create Key** to confirm.
   - **Copy the key immediately** — it starts with `sk-ant-...` and Anthropic only
     shows the full value once. If you lose it, delete that key and make a new one.
5. Paste it into `.env`:
   ```
   ANTHROPIC_API_KEY="sk-ant-...your-key..."
   ```

---

## 2. Vapi Dashboard — the voice engine

1. Go to **dashboard.vapi.ai** and sign up (Google, GitHub, or email).
2. If prompted to create/name an **Organization**, use something like
   `Real Estate Voice Agents` or your own name — it's just a label.
3. You may land in an onboarding wizard/template picker — it's safe to skip or close
   it; our app creates assistants for you via the API, not through this UI.
4. Get your API keys:
   - Left sidebar → **Org Settings** (usually a gear icon near the bottom, or your
     org name in the top-left) → **API Keys** tab.
   - You'll see two keys:
     - **Private Key** — used server-side. This is `VAPI_API_KEY`.
     - **Public Key** — safe to expose in the browser. This is
       `NEXT_PUBLIC_VAPI_PUBLIC_KEY`.
   - Click the copy icon next to each.
5. Paste into `.env`:
   ```
   VAPI_API_KEY="...private key..."
   NEXT_PUBLIC_VAPI_PUBLIC_KEY="...public key..."
   ```
6. **(Optional — only if you want to call a real phone number from `/leads`.)**
   Provision a phone number:
   - Left sidebar → **Phone Numbers** → **Create Phone Number** (or **+**).
   - Choose the **free Vapi trial number** option (no Twilio account needed to get
     started; you can switch to a bring-your-own-Twilio-number later).
   - Once created, click into the number and copy its **Phone Number ID** (a UUID,
     not the phone number itself).
   - Paste into `.env`:
     ```
     VAPI_PHONE_NUMBER_ID="...uuid..."
     ```
   - Skip this step entirely if you only plan to demo with the **"Call in browser"**
     button — that needs no phone number at all.
7. Check **Billing** in the sidebar to see your trial credit balance — outbound
   calls and voice/transcription usage draw from it.

---

## 3. Supabase — the database

1. Go to **supabase.com** and sign up — **Continue with GitHub** is the fastest path
   if you already did step 5 below, otherwise email is fine.
2. Click **New Project**.
   - **Organization**: create one if this is your first project (any name, e.g. your
     name).
   - **Project name**: `voice-agent-builder`.
   - **Database Password**: click **Generate a password**, then **copy and save it
     somewhere** (a notes file) — you may need it if you ever have to rebuild the
     connection string by hand.
   - **Region**: pick whichever is physically closest to you, for lower latency.
   - **Plan**: Free.
   - Click **Create new project**. Provisioning takes ~1–2 minutes.
3. Once the project is ready, get your connection strings — Supabase moved these
   out of Settings and into a dedicated button:
   - At the top of the project page, click **Connect**.
   - In the panel that opens, switch to the **ORMs** tab, then select **Prisma**.
   - It shows you two ready-to-paste values — copy both:
     - `DATABASE_URL` — the **pooled** connection (port `6543`). The app uses this
       one at runtime.
     - `DIRECT_URL` — the **direct** connection (port `5432`). Only the Prisma CLI
       (migrations, `prisma studio`) uses this one — Supabase's pooler doesn't
       support the prepared statements migrations need.
   - If either shows a `[YOUR-PASSWORD]` placeholder instead of the real password,
     replace it with the password you generated in step 2.
4. Paste both into `.env`:
   ```
   DATABASE_URL="postgresql://postgres.xxxxxxx:yourpassword@aws-0-....pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.xxxxxxx:yourpassword@aws-0-....pooler.supabase.com:5432/postgres"
   ```

---

## 4. Cal.com — the calendar the assistant books into

1. Go to **cal.com** and sign up (Google, GitHub, or email).
2. Onboarding wizard: pick a username and timezone. You can skip connecting a
   personal Google/Outlook calendar for now — Cal.com will still track availability
   and bookings internally without one (connect a real calendar later if you want
   bookings to also land on your own calendar).
3. Create the event type the assistant will book into:
   - Left sidebar → **Event Types** → **+ New** (top right).
   - **Title**: `Property Viewing` (or `Consultation Call` — whatever matches the
     agent you're building).
   - **Duration**: `30 minutes` is a sensible default.
   - Click **Continue** / **Save**.
4. Confirm it actually has open availability:
   - Open the event type → **Availability** tab.
   - Make sure a schedule is attached (the default **Working Hours** schedule is
     fine) — an event type with no availability schedule will never return open
     slots.
5. Get the **Event Type ID** (a number, not the slug):
   - While editing the event type, look at your browser's address bar:
     `https://app.cal.com/event-types/123456` — the number after `/event-types/`
     is the ID.
6. Create the API key:
   - Click your avatar (bottom-left) → **Settings**.
   - **Developer** → **API Keys** → **+ Add**.
   - **Name**: `voice-agent-builder`.
   - **Expiration**: `No expiration` is simplest for a demo project (you can always
     revoke it manually later).
   - Click **Save**, then **copy the key immediately** — it starts with `cal_` and,
     like the others, is shown only once.
7. Paste into `.env`:
   ```
   CALCOM_API_KEY="cal_...your-key..."
   CALCOM_EVENT_TYPE_ID="123456"
   ```

---

## 5. GitHub — source control (needed before deploying)

1. Go to **github.com** and sign up if you don't already have an account.
2. Click the **+** icon (top right) → **New repository**.
   - **Repository name**: `voice-agent-builder`.
   - **Visibility**: **Private** is the safer default for now (you can make it
     public later, e.g. to share for the assignment).
   - **Do not** check "Add a README", "Add .gitignore", or "Choose a license" — this
     project already has all of those locally, and initializing on GitHub too would
     create conflicting histories.
   - Click **Create repository**.
3. GitHub will show you a page with push commands under **"…or push an existing
   repository from the command line."** Don't run these yourself — tell me when
   you've created the repo and I'll wire up the remote and push for you (I'll always
   ask before actually pushing).

---

## 6. Vercel — hosting + the public URL Vapi's webhooks need

1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub** (this is the
   recommended path — it lets Vercel import your repos with one click later).
2. Authorize Vercel's GitHub App when prompted. You can grant it access to just the
   `voice-agent-builder` repo instead of all your repos, if you'd rather be
   selective.
3. On the Vercel dashboard: **Add New…** → **Project** → find and select
   `voice-agent-builder` → **Import**.
4. Vercel should auto-detect **Next.js** as the framework — leave the build/output
   settings on their defaults.
5. Before clicking Deploy, expand **Environment Variables** and add every value from
   your local `.env`, one row at a time (Name on the left, Value on the right):
   `DATABASE_URL`, `ANTHROPIC_API_KEY`, `VAPI_API_KEY`, `NEXT_PUBLIC_VAPI_PUBLIC_KEY`,
   `VAPI_PHONE_NUMBER_ID`, `VAPI_WEBHOOK_SECRET`, `VAPI_MODEL`, `CALCOM_API_KEY`,
   `CALCOM_EVENT_TYPE_ID`. Leave `NEXT_PUBLIC_APP_URL` for last — you don't know the
   real URL yet.
6. Click **Deploy** and wait for the first build to finish.
7. Copy the URL Vercel gives you, e.g. `https://voice-agent-builder-yourname.vercel.app`.
8. Go back to the project → **Settings** → **Environment Variables** → add/edit
   `NEXT_PUBLIC_APP_URL` to that exact URL (including `https://`, no trailing
   slash) → **Save**.
9. Go to **Deployments** → open the **⋯** menu on the latest deployment →
   **Redeploy**, so the app picks up the corrected `NEXT_PUBLIC_APP_URL`.
10. From now on, every time you edit an agent in `/builder`, its Vapi webhook URL
    automatically gets re-pointed at this live URL — no manual step needed.

---

## Quick reference — every env var and which account it comes from

| Variable | From |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic → Settings → API Keys |
| `VAPI_API_KEY` | Vapi → Org Settings → API Keys (Private) |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | Vapi → Org Settings → API Keys (Public) |
| `VAPI_PHONE_NUMBER_ID` | Vapi → Phone Numbers (optional) |
| `VAPI_WEBHOOK_SECRET` | You make this up — any random string |
| `VAPI_MODEL` | Leave as default unless Vapi rejects it — see `.env.example` |
| `DATABASE_URL` / `DIRECT_URL` | Supabase → **Connect** button (top of project page) → ORMs → Prisma |
| `CALCOM_API_KEY` | Cal.com → Settings → Developer → API Keys |
| `CALCOM_EVENT_TYPE_ID` | Cal.com → the event type's URL |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally, your Vercel URL once deployed |
