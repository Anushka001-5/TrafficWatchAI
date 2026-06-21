export type DetectionType =
  | "NoHelmet" | "Helmet" | "stop-line" | "illegal_parking" | "red-light"
  | "crosswalk" | "Accident" | "numberplate" | "car" | "bus" | "truck"
  | "motorcycle" | "person";

export interface Detection {
  type: DetectionType | string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface PredictResponse {
  annotated_image_base64: string;
  detections: Detection[];
  plate_number: string | null;
  has_accident: boolean;
  timestamp: string;
}

export const VIOLATION_TYPES = ["NoHelmet", "illegal_parking", "red-light", "stop-line"] as const;
export const VEHICLE_TYPES = ["car", "bus", "truck", "motorcycle", "person"] as const;

export function isViolation(t: string) {
  return (VIOLATION_TYPES as readonly string[]).includes(t);
}
export function isVehicle(t: string) {
  return (VEHICLE_TYPES as readonly string[]).includes(t);
}
export function badgeVariant(t: string): "destructive" | "warning" | "secondary" | "success" {
  if (t === "Accident") return "warning";
  if (isViolation(t)) return "destructive";
  if (t === "Helmet") return "success";
  return "secondary";
}
