import { createFileRoute } from "@tanstack/react-router";
import { UploadDetect } from "@/components/UploadDetect";

export const Route = createFileRoute("/_authenticated/police/")({
  component: () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Detect violation</h1>
        <p className="text-muted-foreground">Upload an image, review detections, and issue chalans.</p>
      </div>
      <UploadDetect uploadedByRole="police" />
    </div>
  ),
});
