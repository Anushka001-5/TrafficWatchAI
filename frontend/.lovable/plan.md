# AI Traffic Violation Detection System

A full-stack app with two role-based portals (Citizen / Traffic Police) powered by Lovable Cloud (auth, database, storage) and an external ML inference API for detection.

## Stack & Setup

- Enable Lovable Cloud (Supabase under the hood) for auth, Postgres, Storage.
- Add deps: `react-leaflet`, `leaflet`, `leaflet.heat`, `recharts`, `react-dropzone`, `date-fns`.
- External ML API: `POST https://kuhu-01-traffic-backend.hf.space/predict` (multipart `file`). Call directly from the browser; if CORS blocks it, add a thin TanStack server route `/api/public/predict` that proxies multipart through.

## Auth & Roles

- Email/password signup with role selector (Citizen / Police).
- Separate `user_roles` table with `app_role` enum (`citizen`, `police`) + `has_role()` security definer function (never store role on profile).
- `profiles` table (id → auth.users, full_name) auto-created via trigger.
- `_authenticated/route.tsx` gate (integration-managed). Top-level `/auth` page. After login, redirect to `/citizen` or `/police` based on role.

## Database Schema (migration)

- `profiles(id uuid pk → auth.users, full_name text, created_at)`
- `app_role` enum: `citizen | police`
- `user_roles(id, user_id, role, unique(user_id, role))`
- `has_role(_user_id, _role)` security-definer fn
- `violation_records(id, image_url, annotated_image_url, plate_number, violation_types text[], confidence_scores jsonb, has_accident bool, timestamp timestamptz, location_lat numeric, location_lng numeric, uploaded_by uuid → auth.users, uploaded_by_role text, chalan_status text default 'pending', created_at)`
- `chalans(id, violation_record_id → violation_records, plate_number, citizen_user_id nullable, amount int, status text default 'pending', issued_by uuid, issued_at, paid_at, created_at)`
- Storage buckets (public): `violation-images`, `annotated-images`.
- RLS:
  - profiles: user reads/updates own; police reads all
  - user_roles: user reads own
  - violation_records: any authenticated insert; citizen reads own uploads + records matching their plate (simplified: own uploads); police reads/updates all
  - chalans: police all; citizen reads where citizen_user_id = auth.uid() OR plate matches their uploads; citizen updates status to 'paid' for own
- GRANTs on all public tables to `authenticated` + `service_role`.

## Routes

```
src/routes/
  __root.tsx                              (existing, add auth state listener)
  index.tsx                               (landing → redirect by role or to /auth)
  auth.tsx                                (login/signup with role selector)
  _authenticated/
    route.tsx                             (integration-managed gate)
    citizen.tsx                           (layout: simple top nav + Outlet)
    citizen.index.tsx                     (upload & detect)
    citizen.chalans.tsx                   (my chalan history)
    police.tsx                            (layout: sidebar nav + Outlet)
    police.index.tsx                      (upload & detect)
    police.log.tsx                        (violation log table)
    police.analytics.tsx                  (charts dashboard)
    police.heatmap.tsx                    (accident heatmap)
    police.chalans.tsx                    (all chalans)
```

Server fns (`src/lib/violations.functions.ts`) with `requireSupabaseAuth`:
- `createViolationRecord({...})`
- `issueChalan({violationRecordId, amount})`
- `updateChalanStatus({id, status})`

Public proxy route (only if needed): `src/routes/api/public/predict.ts` forwarding multipart to HF Space.

## Shared Components

- `UploadDetect` — drag-drop (react-dropzone), preview, Leaflet location picker + geolocation button, submit button. On submit: upload original to Storage, call `/predict`, decode annotated base64 → upload to Storage, insert `violation_records`, display results panel with colored badges (red = NoHelmet/illegal_parking/red-light/stop-line, orange = Accident, green = none), plate number, per-detection confidence, timestamp. Police users see "Issue Chalan" button.
- `ViolationBadge`, `ResultsPanel`, `LocationPicker`, `MapView`, `StatCard`.

## Pages

1. **Upload & Detect** (citizen + police): described above. Vehicle types section only rendered if vehicle classes present in detections.
2. **Violation Log** (police): table with thumbnail/plate/types/confidence/timestamp/location/status; filters by type, date range, plate search, chalan status; row click → detail dialog with full annotated image; sortable.
3. **Analytics** (police): summary cards (total images, total violations, total chalans, top violation), recharts bar (counts by type), line (by hour 0–23), line (per day).
4. **Heatmap** (police): react-leaflet map; markers for `has_accident=true` with popup (thumbnail, type, time); `leaflet.heat` overlay using all violation coords; side panel ranking zones by incident count (cluster lat/lng rounded to ~0.01).
5. **Chalans**:
   - Citizen: list of chalans linked to user's uploads (or detected plate matching), status badges, "Pay Now" mock → updates status to 'paid'.
   - Police: full list with filters (location/date/status), action buttons to mark issued/paid.

## Design System (`src/styles.css`)

Navy/blue + white government-tech aesthetic with red/orange violation accents. All tokens in `oklch`:
- `--background` near-white, `--foreground` deep navy
- `--primary` navy blue (~oklch(0.32 0.09 255)), `--primary-foreground` white
- `--accent` lighter blue
- `--destructive` red for violations
- New tokens: `--warning` orange (accident), `--success` green (no violation), `--police-sidebar` darker navy
- Inter font for body, a slightly tighter heading scale. Custom `Button` variants: `hero`, `violation`, `danger`.
- Police shell uses sidebar layout (shadcn sidebar) with dense data tables; citizen shell uses simple top nav, larger spacing.
- Fully responsive (mobile-first upload page).

## Error Handling

- External API: try/catch with toast "Analysis failed, please try again." Show retry.
- Auth errors surfaced via sonner toasts.
- Loading states everywhere (uploading, analyzing, saving).

## Sitemap / robots

Add `sitemap.xml` route and `robots.txt` listing `/` and `/auth` (portal routes are auth-only).

## Out of scope

- Real payment gateway (mock only).
- Linking chalans to citizens by plate ownership — using uploader user_id as the link; plate-based linking shown as filter.

After scaffolding, I'll seed nothing — the user generates data by uploading.
