import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/police/chalans")({
  component: PoliceChalans,
});

interface Row {
  id: string; amount: number; status: string; plate_number: string | null;
  issued_at: string; paid_at: string | null;
  violation_record_id: string;
  violation_records?: { location_lat: number | null; location_lng: number | null; violation_types: string[] | null } | null;
}

function PoliceChalans() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loc, setLoc] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("chalans")
      .select("id, amount, status, plate_number, issued_at, paid_at, violation_record_id, violation_records(location_lat, location_lng, violation_types)")
      .order("issued_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (status !== "all" && r.status !== status) return false;
      if (from && new Date(r.issued_at) < new Date(from)) return false;
      if (to && new Date(r.issued_at) > new Date(to)) return false;
      if (loc) {
        const v = r.violation_records;
        const s = v ? `${v.location_lat ?? ""},${v.location_lng ?? ""}` : "";
        if (!s.includes(loc)) return false;
      }
      return true;
    });
  }, [rows, status, from, to, loc]);

  const setStatusFor = async (id: string, newStatus: string) => {
    const patch: any = { status: newStatus };
    if (newStatus === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await supabase.from("chalans").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${newStatus}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary">All chalan records</h1>
        <p className="text-muted-foreground">Manage issued and paid chalans.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input placeholder="Location (lat,lng substring)" value={loc} onChange={(e) => setLoc(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plate</TableHead><TableHead>Violations</TableHead>
                <TableHead>Amount</TableHead><TableHead>Issued</TableHead>
                <TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.plate_number ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.violation_records?.violation_types?.join(", ") || "—"}</TableCell>
                  <TableCell>₹{r.amount}</TableCell>
                  <TableCell className="text-xs">{new Date(r.issued_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{r.violation_records?.location_lat?.toFixed(3)}, {r.violation_records?.location_lng?.toFixed(3)}</TableCell>
                  <TableCell><Badge variant={r.status === "paid" ? "default" : r.status === "issued" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    {r.status !== "issued" && <Button size="sm" variant="outline" onClick={() => setStatusFor(r.id, "issued")}>Issue</Button>}
                    {r.status !== "paid" && <Button size="sm" onClick={() => setStatusFor(r.id, "paid")}>Mark paid</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No chalans.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
