import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/citizen")({
  component: CitizenLayout,
});

function CitizenLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (p: string) => pathname === p || (p !== "/citizen" && pathname.startsWith(p));

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/citizen" className="flex items-center gap-2 text-primary font-bold">
            <ShieldCheck className="size-5" /> TrafficWatch
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/citizen"><Button variant={isActive("/citizen") && pathname === "/citizen" ? "secondary" : "ghost"} size="sm">Upload</Button></Link>
            <Link to="/citizen/chalans"><Button variant={isActive("/citizen/chalans") ? "secondary" : "ghost"} size="sm">My Chalans</Button></Link>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="size-4" /></Button>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6"><Outlet /></main>
    </div>
  );
}
