import { createFileRoute } from "@tanstack/react-router";
import { UploadDetect } from "@/components/UploadDetect";

export const Route = createFileRoute("/_authenticated/citizen/")({
  component: () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Report a traffic incident</h1>
        <p className="text-muted-foreground">Upload an image to detect violations and accidents.</p>
      </div>
      <UploadDetect uploadedByRole="citizen" />
    </div>
  ),
});
