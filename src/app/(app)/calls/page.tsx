"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type QualificationResult = {
  qualified: boolean;
  summary: string;
  // Optional: calls recorded before this field existed won't have it.
  keyDetails?: string[];
} | null;

type Call = {
  id: string;
  status: string;
  transcript: string | null;
  recordingUrl: string | null;
  qualificationResult: QualificationResult;
  createdAt: string;
  lead: { name: string; phone: string } | null;
  agent: { name: string };
  meetings: { scheduledAt: string | null; status: string }[];
};

const statusVariant: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
  queued: "outline",
  in_progress: "secondary",
  ended: "default",
  failed: "destructive",
};

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/calls");
      const data = await res.json();
      setCalls(data.calls ?? []);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Calls</CardTitle>
          <p className="text-sm text-muted-foreground">
            Every call the assistant has made, live — transcript, qualification, and booking outcome.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Qualified</TableHead>
                <TableHead>Meeting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                  </TableRow>
                ))}
              {!loading &&
                calls.map((call) => (
                <TableRow key={call.id} className="align-top">
                  <TableCell>{call.lead?.name ?? "Web test call"}</TableCell>
                  <TableCell>{call.agent.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[call.status] ?? "outline"}>{call.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {call.qualificationResult ? (
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="outline"
                          className={
                            call.qualificationResult.qualified
                              ? "border-transparent bg-brand-gold text-brand-gold-foreground"
                              : ""
                          }
                        >
                          {call.qualificationResult.qualified ? "Qualified" : "Not qualified"}
                        </Badge>
                        <p className="max-w-xs text-xs text-muted-foreground">{call.qualificationResult.summary}</p>
                        {call.qualificationResult.keyDetails && call.qualificationResult.keyDetails.length > 0 && (
                          <p className="max-w-xs text-xs text-muted-foreground">
                            {call.qualificationResult.keyDetails.join(" · ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {call.meetings[0]?.scheduledAt ? (
                      <span>{new Date(call.meetings[0].scheduledAt).toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && calls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No calls yet — start one from the Builder (web test call) or Leads tab.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {calls.some((c) => c.transcript) && (
        <Card>
          <CardHeader>
            <CardTitle>Transcripts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {calls
              .filter((c) => c.transcript)
              .map((c) => (
                <details key={c.id} className="text-sm">
                  <summary className="cursor-pointer font-medium">
                    {c.lead?.name ?? "Web test call"} — {new Date(c.createdAt).toLocaleString()}
                  </summary>
                  {c.recordingUrl && (
                    <audio controls preload="none" className="mt-2 h-9 w-full max-w-md">
                      <source src={c.recordingUrl} />
                    </audio>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{c.transcript}</p>
                </details>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
