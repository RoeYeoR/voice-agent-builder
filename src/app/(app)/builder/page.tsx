"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WebCallButton } from "@/components/web-call-button";
import { Sparkles, PhoneCall } from "lucide-react";
import { toast } from "sonner";

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

// How fast pasted text "types" itself out — for recording a clean demo
// instead of the text dumping in instantly. Constant rhythm, ms per character.
const TYPE_SPEED_MS = 28;

export default function BuilderPage() {
  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, []);

  function stopTyping() {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setTyping(false);
  }

  // Intercepts a real paste and replays it as a typewriter effect instead of
  // dumping the text in instantly — for recording a clean, elegant demo.
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();

    stopTyping();

    const target = e.currentTarget;
    const start = target.selectionStart ?? input.length;
    const end = target.selectionEnd ?? input.length;
    const before = input.slice(0, start);
    const after = input.slice(end);

    setTyping(true);
    let i = 0;
    typingTimerRef.current = setInterval(() => {
      i++;
      setInput(before + text.slice(0, i) + after);
      if (i >= text.length) stopTyping();
    }, TYPE_SPEED_MS);
  }

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
    if (!text || loading || typing) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

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
        toast.warning("Saved locally, but couldn't sync to Vapi yet", {
          description: `${data.vapiError} — add your Vapi keys to .env and try again.`,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function startNewAgent() {
    localStorage.removeItem(STORAGE_KEY);
    setAgent(null);
    setMessages([]);
  }

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-2">
      <Card className="flex h-[75vh] flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Builder chat</CardTitle>
            <p className="text-sm text-muted-foreground">Describe the agent; watch it appear on the right.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={startNewAgent}>
            New agent
          </Button>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2">
            <div className="flex flex-col gap-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="size-4" strokeWidth={2.25} />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Describe any voice agent you want — it&apos;s not limited to one industry. For example:
                    &quot;Build me an assistant that calls real estate leads, asks about their budget, timeline,
                    and preferred neighborhood, and books a viewing once they agree on a time,&quot; or
                    &quot;Build me a SaaS demo booker that asks about team size and current tooling, then books
                    a 30-minute demo.&quot;
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] animate-in fade-in slide-in-from-bottom-1 rounded-lg px-3 py-2 text-sm duration-300 ${
                    m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {loading && (
                <p className="animate-in fade-in text-sm text-muted-foreground">Thinking…</p>
              )}
            </div>
          </div>
          <form onSubmit={sendMessage} className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Escape" && typing) {
                  stopTyping();
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!typing) sendMessage(e);
                }
              }}
              placeholder="Describe your agent, or ask for a change…"
              className="min-h-[44px] flex-1 resize-none"
            />
            <Button type="submit" disabled={loading || typing || !input.trim()}>
              Send
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent preview</CardTitle>
          <p className="text-sm text-muted-foreground">The live config, synced straight to Vapi.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {!agent ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <PhoneCall className="size-4" strokeWidth={2.25} />
              </span>
              <p className="text-muted-foreground">
                Nothing built yet — describe your agent in the chat and it&apos;ll show up here.
              </p>
            </div>
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
                <Badge
                  variant="outline"
                  className={agent.vapiAssistantId ? "border-transparent bg-brand-gold text-brand-gold-foreground" : ""}
                >
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
