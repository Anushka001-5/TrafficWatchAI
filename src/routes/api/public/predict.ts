import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/predict")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const file = form.get("file");
          if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: "Missing file" }), {
              status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
          const fd = new FormData();
          fd.append("file", file, (file as File).name);
          const res = await fetch("https://kuhu-01-traffic-backend.hf.space/predict", {
            method: "POST", body: fd,
          });
          const text = await res.text();
          return new Response(text, {
            status: res.status,
            headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json", ...corsHeaders },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message ?? "Predict failed" }), {
            status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      },
    },
  },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
