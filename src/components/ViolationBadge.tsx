import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { badgeVariant } from "@/lib/types";

export function ViolationBadge({ type, confidence }: { type: string; confidence?: number }) {
  const v = badgeVariant(type);
  const cls = cn(
    "rounded-full border font-medium",
    v === "destructive" && "bg-destructive/10 text-destructive border-destructive/30",
    v === "warning" && "bg-warning/15 text-warning-foreground border-warning/40",
    v === "success" && "bg-success/15 text-success border-success/30",
    v === "secondary" && "bg-secondary text-secondary-foreground border-border",
  );
  return (
    <Badge variant="outline" className={cls}>
      {type}{typeof confidence === "number" && ` · ${Math.round(confidence * 100)}%`}
    </Badge>
  );
}
