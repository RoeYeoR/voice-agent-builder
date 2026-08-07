"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WebCallButton } from "@/components/web-call-button";

type ChatMessage = { role: "user" | "assistant"; content: string };

type AgentConfig = {
  id: string;
  name: string;
  firstMessage: string;
  systemPrompt: string;
  voiceId: string;
  qualificationCriteria: string[];
  vapiAssistantId: string | null;
};

const STORAGE_KEY = "voice-agent-builder:agentId";

export default function BuilderPage() {
  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vapiWarning, setVapiWarning] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (!savedId) return;
    fetch(`/api/builder?agentId=${savedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.agent) return;
        setAgent(data.agent);
        setMessages(data.agent.messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })));
      });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setError(null);
    setVapiWarning(null);

    try {
      const res = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent?.id, message: text }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
      const data = await res.json();

      setAgent(data.agent);
      localStorage.setItem(STORAGE_KEY, data.agent.id);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.vapiError) {
        setVapiWarning(
          `Saved locally, but couldn't sync to Vapi yet: ${data.vapiError}. Add your Vapi keys to .env and try again.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function startNewAgent() {
    localStorage.removeItem(STORAGE_KEY);
    setAgent(null);
    setMessages([]);
    setError(null);
    setVapiWarning(null);
  }

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-2">
      <Card className="flex h-[75vh] flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Builder chat</CardTitle>
          <Button variant="ghost" size="sm" onClick={startNewAgent}>
            New agent
          </Button>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2">
            <div className="flex flex-col gap-3">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Describe any voice agent you want — it&apos;s not limited to one industry. For example:
                  &quot;Build me an assistant that calls real estate leads, asks about their budget, timeline,
                  and preferred neighborhood, and books a viewing once they agree on a time,&quot; or
                  &quot;Build me a SaaS demo booker that asks about team size and current tooling, then books
                  a 30-minute demo.&quot;
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {loading && <p className="text-sm text-muted-foreground">Thinking…</p>}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {vapiWarning && <p className="text-xs text-amber-600">{vapiWarning}</p>}
          <form onSubmit={sendMessage} className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
              placeholder="Describe your agent, or ask for a change…"
              className="min-h-[44px] flex-1 resize-none"
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              Send
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent preview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {!agent ? (
            <p className="text-muted-foreground">
              Nothing built yet — describe your agent in the chat and it&apos;ll show up here.
            </p>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Name</p>
                <p>{agent.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Greeting</p>
                <p>{agent.firstMessage || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Qualification criteria</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {agent.qualificationCriteria?.length ? (
                    agent.qualificationCriteria.map((c, i) => (
                      <Badge key={i} variant="secondary">
                        {c}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Voice ID</span>
                <code className="text-xs">{agent.voiceId}</code>
              </div>
              <p className="text-xs text-muted-foreground">
                Change it by telling the chat an exact ElevenLabs voice ID to use — e.g. &quot;use voice ID
                pNInz6obpgDQGcFmaJgB&quot;.
              </p>
              <Separator />
              <details>
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Full system prompt
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                  {agent.systemPrompt || "—"}
                </p>
              </details>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Vapi sync</span>
                <Badge variant={agent.vapiAssistantId ? "default" : "outline"}>
                  {agent.vapiAssistantId ? "Synced" : "Not synced yet"}
                </Badge>
              </div>
              {agent.vapiAssistantId && <WebCallButton assistantId={agent.vapiAssistantId} />}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
