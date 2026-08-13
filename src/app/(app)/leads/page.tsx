"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
};

type Agent = {
  id: string;
  name: string;
  vapiAssistantId: string | null;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [leadsRes, agentsRes] = await Promise.all([fetch("/api/leads"), fetch("/api/builder")]);
    const leadsData = await leadsRes.json();
    const agentsData = await agentsRes.json();
    setLeads(leadsData.leads ?? []);
    const readyAgents: Agent[] = (agentsData.agents ?? []).filter((a: Agent) => a.vapiAssistantId);
    setAgents(readyAgents);
    setSelectedAgentId((prev) => prev || readyAgents[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    // Fetch-on-mount to hydrate from the server; `refresh` is also reused by
    // the add/call handlers below, so it lives outside the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", phone: "", email: "" });
    refresh();
  }

  async function callLead(leadId: string) {
    if (!selectedAgentId) {
      toast.error("Build and sync an agent first (in the Builder tab).");
      return;
    }
    setBusyLeadId(leadId);
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: selectedAgentId, leadId }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success("Call started", { description: "Check the Calls tab for progress." });
    } else {
      toast.error(data.error ?? "Failed to start the call");
    }
    setBusyLeadId(null);
    refresh();
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a lead</CardTitle>
          <p className="text-sm text-muted-foreground">Who should the agent call next?</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={addLead} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
            <div className="flex flex-col gap-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="phone">Phone (E.164, e.g. +15551234567)</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <Button type="submit">Add lead</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Leads</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Call with:</span>
            <Select value={selectedAgentId} onValueChange={(value) => setSelectedAgentId(value ?? "")}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
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
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-7 w-14" />
                    </TableCell>
                  </TableRow>
                ))}
              {!loading &&
                leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>{lead.name}</TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{lead.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" disabled={busyLeadId === lead.id} onClick={() => callLead(lead.id)}>
                      {busyLeadId === lead.id ? "Calling…" : "Call"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No leads yet — add one above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
