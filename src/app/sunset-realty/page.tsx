"use client";

import { useState } from "react";
import { Home, PhoneCall, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WebCallButton } from "@/components/web-call-button";
import { toast } from "sonner";

// A stand-in for a real estate agency's own marketing site — the "customer
// side" of the demo. Deliberately outside the (app) route group: no internal
// tool nav here, this is meant to look like a completely different website
// that just happens to be calling the same backend.
//
// The "talk now" handoff is a browser WebRTC call (same mechanism as the
// builder's "Call in browser"), not a real phone call — that needs a Vapi
// phone number we don't have configured. This still demonstrates the exact
// same live AI conversation, just answered right here instead of on a phone.

type Result = { called: boolean; agentName?: string; webCall: { assistantId: string; agentName: string } | null } | null;

export default function SunsetRealtyPage() {
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/public/inquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setResult({ called: data.called, agentName: data.agentName, webCall: data.webCall ?? null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-secondary/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Home className="size-4" strokeWidth={2.25} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Sunset Realty</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-14">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" /> Serving the greater metro area
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Find your next home.</h1>
          <p className="max-w-lg text-muted-foreground">
            Tell us a little about what you&apos;re looking for and a member of our team will reach out —
            usually within minutes.
          </p>
        </div>

        {result ? (
          <div className="flex flex-col items-start gap-4 rounded-xl border bg-background p-6">
            {result.called ? (
              <>
                <span className="flex items-center gap-2 text-lg font-medium">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                  </span>
                  {result.agentName ?? "Our team"} is calling you now
                </span>
                <p className="text-sm text-muted-foreground">
                  Answer the phone — you&apos;re about to talk to our AI assistant, live.
                </p>
              </>
            ) : (
              <>
                <span className="text-lg font-medium">Thanks — we&apos;ve got your request!</span>
                <p className="text-sm text-muted-foreground">A member of our team will be in touch shortly.</p>
              </>
            )}
            {result.webCall && (
              <>
                <div className="h-px w-full bg-border" />
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Don&apos;t want to wait?</span>
                  <p className="text-sm text-muted-foreground">
                    Talk to {result.webCall.agentName} right now — click below and allow microphone access.
                  </p>
                  <WebCallButton
                    assistantId={result.webCall.assistantId}
                    idleLabel={`Talk to ${result.webCall.agentName} now`}
                    size="lg"
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border bg-background p-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                required
                placeholder="+15551234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">What are you looking for?</Label>
              <Textarea
                id="notes"
                placeholder="e.g. 3-bedroom home, north side, moving in the next couple of months"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-fit">
              <PhoneCall className="size-4" />
              {submitting ? "Sending…" : "Request a callback"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
