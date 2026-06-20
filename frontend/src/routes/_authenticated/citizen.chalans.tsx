import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/citizen/chalans")({
  component: CitizenChalans,
});

interface Chalan {
  id: string; amount: number; status: string; plate_number: string | null;
  issued_at: string; paid_at: string | null;
  violation_record_id: string;
  violation_records?: { violation_types: string[] | null; location_lat: number | null; location_lng: number | null } | null;
}

function CitizenChalans() {
  const [items, setItems] = useState<Chalan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("chalans")
      .select("id, amount, status, plate_number, issued_at, paid_at, violation_record_id, violation_records(violation_types, location_lat, location_lng)")
      .order("issued_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const pay = async (id: string) => {
    const { error } = await supabase.from("chalans").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payment successful");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">My chalan history</h1>
        <p className="text-muted-foreground">Chalans linked to your uploads.</p>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> :
        items.length === 0 ? <p className="text-sm text-muted-foreground">No chalans yet.</p> :
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center text-base">
                  <span className="font-mono">{c.plate_number ?? "—"}</span>
                  <Badge variant={c.status === "paid" ? "default" : c.status === "issued" ? "destructive" : "secondary"}>{c.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Violations:</span> {c.violation_records?.violation_types?.join(", ") || "—"}</p>
                <p><span className="text-muted-foreground">Amount:</span> ₹{c.amount}</p>
                <p><span className="text-muted-foreground">Issued:</span> {new Date(c.issued_at).toLocaleString()}</p>
                {c.status !== "paid" && (
                  <Button size="sm" className="w-full mt-2" onClick={() => pay(c.id)}>Pay Now</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      }
    </div>
  );
}
