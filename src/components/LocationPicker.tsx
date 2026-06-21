import { useEffect, useRef } from "react";
import type * as LType from "leaflet";

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

export function LocationPicker({ lat, lng, onChange }: LocationPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const markerRef = useRef<LType.Marker | null>(null);
  const LRef = useRef<typeof LType | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;
      LRef.current = L;
      const center: LType.LatLngExpression = lat && lng ? [lat, lng] : [28.6139, 77.209];
      const map = L.map(ref.current).setView(center, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;
      map.on("click", (e: LType.LeafletMouseEvent) => onChange(e.latlng.lat, e.latlng.lng));
      if (lat && lng) markerRef.current = L.marker([lat, lng]).addTo(map);
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = LRef.current;
    if (!mapRef.current || !L) return;
    if (lat && lng) {
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      else markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
    }
  }, [lat, lng]);

  return <div ref={ref} className="w-full h-64 rounded-md border" />;
}
