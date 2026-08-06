"use client";

import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import { Button } from "@/components/ui/button";

export function WebCallButton({ assistantId }: { assistantId: string }) {
  const vapiRef = useRef<Vapi | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "in-call">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!publicKey) return;
    const vapi = new Vapi(publicKey);
    vapiRef.current = vapi;

    vapi.on("call-start", () => setStatus("in-call"));
    vapi.on("call-end", () => setStatus("idle"));
    vapi.on("error", (e) => {
      setError(e instanceof Error ? e.message : "Call failed");
      setStatus("idle");
    });

    return () => {
      vapi.stop();
    };
  }, []);

  if (!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY) {
    return (
      <p className="text-xs text-muted-foreground">
        Add NEXT_PUBLIC_VAPI_PUBLIC_KEY to .env to enable browser test calls.
      </p>
    );
  }

  function handleClick() {
    setError(null);
    if (status === "in-call") {
      vapiRef.current?.stop();
      return;
    }
    setStatus("connecting");
    vapiRef.current?.start(assistantId);
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={status === "in-call" ? "destructive" : "default"}
        onClick={handleClick}
        disabled={status === "connecting"}
      >
        {status === "in-call" ? "End call" : status === "connecting" ? "Connecting…" : "Call in browser"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
