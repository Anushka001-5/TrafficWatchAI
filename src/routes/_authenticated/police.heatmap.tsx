import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as LType from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/police/heatmap")({
  component: Heatmap,
});

interface Rec {
  id: string; annotated_image_url: string | null; violation_types: string[];
  has_accident: boolean; timestamp: string; location_lat: number; location_lng: number;
}

function Heatmap() {
  const [records, setRecords] = useState<Rec[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const layersRef = useRef<LType.LayerGroup | null>(null);
  const LRef = useRef<typeof LType | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.from("violation_records").select("id, annotated_image_url, violation_types, has_accident, timestamp, location_lat, location_lng")
      .eq("has_accident", true)
      .not("location_lat", "is", null).not("location_lng", "is", null)
      .then(({ data }) => setRecords((data ?? []) as any));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.heat");
      if (cancelled || !ref.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(ref.current).setView([28.6139, 77.209], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OSM" }).addTo(map);
      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      setReady(true);
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const L = LRef.current;
    if (!ready || !mapRef.current || !layersRef.current || !L) return;
    layersRef.current.clearLayers();
    if (records.length === 0) return;
    const heatPoints = records.map(r => [r.location_lat, r.location_lng, 0.6] as [number, number, number]);
    // @ts-expect-error heatLayer
    L.heatLayer(heatPoints, { radius: 25, blur: 18 }).addTo(layersRef.current);

    records.forEach(r => {
      const m = L.marker([r.location_lat, r.location_lng]).addTo(layersRef.current!);
      m.bindPopup(`
        <div style="min-width:160px">
          ${r.annotated_image_url ? `<img src="${r.annotated_image_url}" style="width:100%;height:80px;object-fit:cover;border-radius:4px;margin-bottom:6px"/>` : ""}
          <div style="font-size:11px;color:#555">${new Date(r.timestamp).toLocaleString()}</div>
          <div style="font-size:12px">${r.location_lat.toFixed(4)}, ${r.location_lng.toFixed(4)}</div>
          <div style="font-size:12px;color:#b91c1c">${r.violation_types?.join(", ") || "—"}</div>
        </div>
      `);
    });

    const bounds = L.latLngBounds(records.map(r => [r.location_lat, r.location_lng] as [number, number]));
    if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [40, 40] });
  }, [records, ready]);

  const zones = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number; items: Rec[] }>();
    for (const r of records) {
      const key = `${r.location_lat.toFixed(2)},${r.location_lng.toFixed(2)}`;
      if (!map.has(key)) map.set(key, { lat: +r.location_lat.toFixed(2), lng: +r.location_lng.toFixed(2), items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length).slice(0, 8);
  }, [records]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary">Accident-prone heatmap</h1>
        <p className="text-muted-foreground">Density of accident markers across the city.</p>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-2">
            <div ref={ref} className="w-full h-[520px] rounded-md" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top zones</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[520px] overflow-y-auto">
            {zones.length === 0 && <p className="text-sm text-muted-foreground">No location data.</p>}
            {zones.map((z, i) => (
              <div key={i} className="border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-mono">{z.lat.toFixed(2)}, {z.lng.toFixed(2)}</div>
                  <span className="text-xs bg-destructive/10 text-destructive rounded-full px-2 py-0.5">{z.items.length} accidents</span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {z.items.slice(0, 5).map(i => (
                    <li key={i.id}>{new Date(i.timestamp).toLocaleString()} · {i.violation_types?.[0] ?? "—"}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
