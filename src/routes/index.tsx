import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Camera, BarChart3, MapPin } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrafficWatch AI — AI Traffic Violation Detection" },
      { name: "description", content: "Detect helmet, parking, signal and accident violations from traffic images using AI. Built for citizens and traffic police." },
      { property: "og:title", content: "TrafficWatch AI" },
      { property: "og:description", content: "AI-powered traffic violation detection for citizens and police." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role) {
      navigate({ to: role === "police" ? "/police" : "/citizen", replace: true });
    }
  }, [loading, user, role, navigate]);

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="size-6" />
            <span className="font-bold text-lg">TrafficWatch AI</span>
          </div>
          <Link to="/auth"><Button>Sign in</Button></Link>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20 text-center">
        <span className="inline-block rounded-full bg-accent/10 text-accent px-3 py-1 text-xs font-medium">Powered by AI Detection</span>
        <h1 className="mt-4 text-4xl md:text-6xl font-bold text-primary">Smarter roads through<br/>intelligent enforcement</h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
          Upload a traffic image to instantly detect helmet violations, illegal parking,
          red-light running, accidents and license plates. For citizens and traffic police.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth"><Button size="lg">Get started</Button></Link>
        </div>
      </section>

      <section className="container mx-auto grid md:grid-cols-4 gap-4 px-4 pb-20">
        {[
          { icon: Camera, title: "Instant Detection", text: "Upload images, get annotated results in seconds." },
          { icon: ShieldCheck, title: "Two Portals", text: "Tailored UIs for citizens and traffic police." },
          { icon: BarChart3, title: "Live Analytics", text: "Track violation trends and chalan history." },
          { icon: MapPin, title: "Accident Heatmap", text: "Identify accident-prone zones on a map." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border bg-card p-6">
            <Icon className="size-6 text-accent" />
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
