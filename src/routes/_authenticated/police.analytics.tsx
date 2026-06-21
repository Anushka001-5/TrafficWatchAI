import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Camera, AlertTriangle, Receipt, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/police/analytics")({
  component: Analytics,
});

function Analytics() {
  const [records, setRecords] = useState<any[]>([]);
  const [chalansCount, setChalansCount] = useState(0);

  useEffect(() => {
    supabase.from("violation_records").select("*").then(({ data }) => setRecords(data ?? []));
    supabase.from("chalans").select("id", { count: "exact", head: true }).then(({ count }) => setChalansCount(count ?? 0));
  }, []);

  const stats = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<string, number> = {};
    let totalViolations = 0;
    for (const r of records) {
      const types: string[] = r.violation_types ?? [];
      for (const t of types) { typeCounts[t] = (typeCounts[t] ?? 0) + 1; totalViolations++; }
      const ts = new Date(r.timestamp);
      const h = ts.getHours(); hourCounts[h] = (hourCounts[h] ?? 0) + 1;
      const d = ts.toISOString().slice(0, 10); dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    }
    const byType = Object.entries(typeCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
    const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: hourCounts[i] ?? 0 }));
    const byDay = Object.entries(dayCounts).sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }));
    return { byType, byHour, byDay, totalViolations, top: byType[0]?.type ?? "—" };
  }, [records]);

  const cards = [
    { label: "Images processed", value: records.length, icon: Camera },
    { label: "Violations detected", value: stats.totalViolations, icon: AlertTriangle },
    { label: "Chalans issued", value: chalansCount, icon: Receipt },
    { label: "Top violation", value: stats.top, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Analytics dashboard</h1>
        <p className="text-muted-foreground">Live insights across all processed images.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-md bg-accent/10 text-accent flex items-center justify-center"><c.icon className="size-5" /></div>
              <div><div className="text-xs text-muted-foreground">{c.label}</div><div className="text-2xl font-bold">{c.value}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Violations by type</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="type" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Violations by hour</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Trend over time</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
