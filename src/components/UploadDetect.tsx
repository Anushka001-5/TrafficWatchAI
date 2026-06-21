import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationPicker } from "./LocationPicker";
import { ViolationBadge } from "./ViolationBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, MapPin, Loader2, Car } from "lucide-react";
import { isVehicle, isViolation, type PredictResponse } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";

interface UploadDetectProps {
  uploadedByRole: "citizen" | "police";
}

export function UploadDetect({ uploadedByRole }: UploadDetectProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [annotatedUrl, setAnnotatedUrl] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [issuingChalan, setIssuingChalan] = useState(false);

  const onDrop = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f); setResult(null); setAnnotatedUrl(null); setRecordId(null);
    setPreviewUrl(URL.createObjectURL(f));
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "image/*": [] }, maxFiles: 1,
  });

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); },
      () => toast.error("Could not get location"),
    );
  };

  const submit = async () => {
    if (!file) return toast.error("Please select an image");
    if (lat == null || lng == null) return toast.error("Please set the incident location");
    if (!user) return;

    setLoading(true);
    try {
      // 1) Upload original to storage
      const ext = file.name.split(".").pop() || "jpg";
      const origPath = `${user.id}/${Date.now()}.${ext}`;
      const upOrig = await supabase.storage.from("violation-images").upload(origPath, file);
      if (upOrig.error) throw upOrig.error;
      const origSigned = await supabase.storage.from("violation-images").createSignedUrl(origPath, 60 * 60 * 24 * 365);
      const imageUrl = origSigned.data?.signedUrl ?? "";

      // 2) Call ML API via proxy (avoids CORS)
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/public/predict", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Analysis failed");
      const data = (await res.json()) as PredictResponse;

      // 3) Upload annotated image
      const annB = Uint8Array.from(atob(data.annotated_image_base64), c => c.charCodeAt(0));
      const annBlob = new Blob([annB], { type: "image/jpeg" });
      const annPath = `${user.id}/${Date.now()}_annotated.jpg`;
      const upAnn = await supabase.storage.from("annotated-images").upload(annPath, annBlob, { contentType: "image/jpeg" });
      if (upAnn.error) throw upAnn.error;
      const annSigned = await supabase.storage.from("annotated-images").createSignedUrl(annPath, 60 * 60 * 24 * 365);
      const annUrl = annSigned.data?.signedUrl ?? "";

      // 4) Insert record
      const types = Array.from(new Set(data.detections.map(d => d.type)));
      const { data: rec, error } = await supabase.from("violation_records").insert({
        image_url: imageUrl,
        annotated_image_url: annUrl,
        plate_number: data.plate_number,
        violation_types: types,
        confidence_scores: data.detections as any,
        detections: data.detections as any,
        has_accident: data.has_accident,
        timestamp: data.timestamp,
        location_lat: lat,
        location_lng: lng,
        uploaded_by: user.id,
        uploaded_by_role: uploadedByRole,
      }).select("id").single();
      if (error) throw error;

      setResult(data);
      setAnnotatedUrl(annUrl);
      setRecordId(rec.id);
      toast.success("Analysis complete");
    } catch (e: any) {
      console.error(e);
      toast.error("Analysis failed, please try again");
    } finally {
      setLoading(false);
    }
  };

  const issueChalan = async () => {
    if (!recordId || !result) return;
    setIssuingChalan(true);
    const { error } = await supabase.from("chalans").insert({
      violation_record_id: recordId,
      plate_number: result.plate_number,
      amount: 1000,
      status: "issued",
      issued_by: user?.id,
    });
    if (!error) {
      await supabase.from("violation_records").update({ chalan_status: "issued" }).eq("id", recordId);
    }
    setIssuingChalan(false);
    if (error) toast.error(error.message); else toast.success("Chalan issued");
  };

  const violations = result?.detections.filter(d => isViolation(d.type)) ?? [];
  const vehicles = result?.detections.filter(d => isVehicle(d.type)) ?? [];
  const accidents = result?.detections.filter(d => d.type === "Accident") ?? [];

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Upload traffic image</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm">Drag & drop an image, or click to select</p>
            {file && <p className="mt-1 text-xs text-muted-foreground">{file.name}</p>}
          </div>

          {previewUrl && (
            <img src={previewUrl} alt="preview" className="w-full max-h-64 object-contain rounded-md border" />
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2"><MapPin className="size-4" /> Incident location</span>
              <Button type="button" size="sm" variant="outline" onClick={useMyLocation}>Use my current location</Button>
            </div>
            <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
            {lat != null && lng != null && (
              <p className="text-xs text-muted-foreground">Selected: {lat.toFixed(5)}, {lng.toFixed(5)}</p>
            )}
          </div>

          <Button onClick={submit} disabled={loading || !file} className="w-full">
            {loading ? <><Loader2 className="size-4 mr-2 animate-spin" /> Analyzing traffic image...</> : "Analyze image"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Detection results</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!result && !loading && (
            <p className="text-sm text-muted-foreground">Results will appear here after analysis.</p>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Running AI detection...</div>
          )}
          {result && annotatedUrl && (
            <>
              <img src={annotatedUrl} alt="annotated" className="w-full rounded-md border" />

              <div>
                <h4 className="text-sm font-semibold mb-2">Violations</h4>
                {violations.length === 0 && accidents.length === 0 ? (
                  <ViolationBadge type="No violation detected" />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[...violations, ...accidents].map((d, i) => (
                      <ViolationBadge key={i} type={d.type} confidence={d.confidence} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-1">License plate</h4>
                <p className="font-mono text-sm">{result.plate_number ?? <span className="text-muted-foreground">Not detected</span>}</p>
              </div>

              {vehicles.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Car className="size-4" /> Vehicles & people</h4>
                  <div className="flex flex-wrap gap-2">
                    {vehicles.map((d, i) => (
                      <ViolationBadge key={i} type={d.type} confidence={d.confidence} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-1">Timestamp</h4>
                <p className="text-sm text-muted-foreground">{new Date(result.timestamp).toLocaleString()}</p>
              </div>

              {uploadedByRole === "police" && (violations.length > 0 || accidents.length > 0) && (
                <Button onClick={issueChalan} disabled={issuingChalan} variant="default" className="w-full">
                  {issuingChalan ? "Issuing..." : "Issue Chalan"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
