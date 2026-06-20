import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ShieldCheck, Upload, ListChecks, BarChart3, MapPin, Receipt, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/police")({
  component: PoliceLayout,
});

const nav: Array<{ to: string; label: string; icon: typeof Upload; exact?: boolean }> = [
  { to: "/police", label: "Upload", icon: Upload, exact: true },
  { to: "/police/log", label: "Violation Log", icon: ListChecks },
  { to: "/police/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/police/heatmap", label: "Heatmap", icon: MapPin },
  { to: "/police/chalans", label: "Chalans", icon: Receipt },
];

function PoliceLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col shrink-0 hidden md:flex">
        <div className="px-4 py-5 flex items-center gap-2 border-b border-sidebar-border">
          <ShieldCheck className="size-5 text-sidebar-primary" />
          <div>
            <div className="font-bold leading-tight">TrafficWatch</div>
            <div className="text-xs text-sidebar-foreground/60">Police Portal</div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}>
                <n.icon className="size-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={signOut} className="m-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent">
          <LogOut className="size-4" /> Sign out
        </button>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center gap-3 overflow-x-auto">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return <Link key={n.to} to={n.to} className={cn("text-xs whitespace-nowrap px-2 py-1 rounded", active && "bg-sidebar-primary text-sidebar-primary-foreground")}>{n.label}</Link>;
          })}
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-auto"><Outlet /></main>
      </div>
    </div>
  );
}
