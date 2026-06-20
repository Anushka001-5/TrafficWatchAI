import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ViolationBadge } from "@/components/ViolationBadge";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/police/log")({
  component: ViolationLog,
});

interface Record {
  id: string; image_url: string; annotated_image_url: string | null;
  plate_number: string | null; violation_types: string[]; has_accident: boolean;
  timestamp: string; location_lat: number | null; location_lng: number | null;
  chalan_status: string; confidence_scores: any;
}

const TYPES = ["NoHelmet", "illegal_parking", "red-light", "stop-line", "Accident"];

function ViolationLog() {
  const [items, setItems] = useState<Record[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortBy, setSortBy] = useState<"timestamp" | "confidence">("timestamp");
  const [selected, setSelected] = useState<Record | null>(null);

  useEffect(() => {
    supabase.from("violation_records").select("*").order("timestamp", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as any));
  }, []);

  const filtered = useMemo(() => {
    let r = items;
    if (search) r = r.filter(i => i.plate_number?.toLowerCase().includes(search.toLowerCase()));
    if (type !== "all") r = r.filter(i => i.violation_types?.includes(type));
    if (status !== "all") r = r.filter(i => i.chalan_status === status);
    if (from) r = r.filter(i => new Date(i.timestamp) >= new Date(from));
    if (to) r = r.filter(i => new Date(i.timestamp) <= new Date(to));
    const maxConf = (i: Record) => Array.isArray(i.confidence_scores) ? Math.max(0, ...i.confidence_scores.map((d: any) => d.confidence ?? 0)) : 0;
    return [...r].sort((a, b) => sortBy === "timestamp"
      ? +new Date(b.timestamp) - +new Date(a.timestamp)
      : maxConf(b) - maxConf(a));
  }, [items, search, type, status, from, to, sortBy]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary">Violation log</h1>
        <p className="text-muted-foreground">All detected violations across the system.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-6 gap-3">
          <Input placeholder="Plate number" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="timestamp">Sort: Newest</SelectItem>
              <SelectItem value="confidence">Sort: Confidence</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead><TableHead>Plate</TableHead>
                <TableHead>Violations</TableHead><TableHead>Confidence</TableHead>
                <TableHead>Time</TableHead><TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const maxConf = Array.isArray(r.confidence_scores) ? Math.max(0, ...r.confidence_scores.map((d: any) => d.confidence ?? 0)) : 0;
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                    <TableCell>
                      {r.annotated_image_url && <img src={r.annotated_image_url} className="w-16 h-12 object-cover rounded" alt="" />}
                    </TableCell>
                    <TableCell className="font-mono">{r.plate_number ?? "—"}</TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{r.violation_types?.slice(0, 3).map((t, i) => <ViolationBadge key={i} type={t} />)}</div></TableCell>
                    <TableCell>{Math.round(maxConf * 100)}%</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(r.timestamp).toLocaleString()}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.location_lat?.toFixed(3)}, {r.location_lng?.toFixed(3)}</TableCell>
                    <TableCell><Badge variant={r.chalan_status === "paid" ? "default" : r.chalan_status === "issued" ? "destructive" : "secondary"}>{r.chalan_status}</Badge></TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No records.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Violation details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              {selected.annotated_image_url && <img src={selected.annotated_image_url} className="w-full rounded-md border" alt="" />}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Plate:</span> <span className="font-mono">{selected.plate_number ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Time:</span> {new Date(selected.timestamp).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Location:</span> {selected.location_lat?.toFixed(5)}, {selected.location_lng?.toFixed(5)}</div>
                <div><span className="text-muted-foreground">Status:</span> {selected.chalan_status}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(selected.confidence_scores) && selected.confidence_scores.map((d: any, i: number) =>
                  <ViolationBadge key={i} type={d.type} confidence={d.confidence} />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
