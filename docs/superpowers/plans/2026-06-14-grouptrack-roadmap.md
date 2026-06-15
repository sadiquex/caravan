# GroupTrack MVP — Development Roadmap

> **Status:** Living document. The PRD is `docs/PRD.md`. The current codebase is a frontend-only prototype (`app/components/GroupTrack.tsx`) with mock data and a client-side state machine — see `CLAUDE.md`.

**Goal:** Take the prototype to a shippable MVP: groups create a temporary trip, join by link, share live location, and see at-a-glance who is ahead / behind / with the group / stopped / arrived — no accounts, auto-expiring in 8h.

This roadmap breaks the MVP into **6 sequential phases**. Each phase produces working, demoable software and is its own detailed plan. Phases are ordered so that the riskiest unknown (mobile geolocation reliability) is de-risked early and so the UI is wired to real data before polish.

---

## Why this order

The README's instincts are right: **geolocation reliability decides what's buildable**. But we can't test geolocation meaningfully without somewhere to send positions, and we can't test the realtime UI without a backend. So Phase 1 stands up Supabase + trip create/join (no location), Phase 2 layers real geolocation on top and is where the spike happens, and everything else builds on a working live system.

Cross-cutting rule for every phase: **TDD where there is logic** (status engine, share-code generation, distance math, expiry) — these are pure functions and must have unit tests. UI wiring and Supabase plumbing are verified by running the app.

---

## Phase 1 — Supabase foundation + trip create/join (no location yet)

**Detailed plan:** `docs/superpowers/plans/2026-06-14-phase-1-supabase-foundation.md`

**Delivers:** A real trip can be created (real 6-char share code), the Share screen shows a real joinable link, a second device opens the link and joins with a name, and both screens see the participant list update **live** via Supabase Realtime. No location yet — `latitude/longitude/status` are null.

**Scope:**
- Add Supabase (`@supabase/supabase-js`), env config, browser client.
- Create `trips` and `participants` tables matching the PRD data model + RLS policies keyed off `share_code`.
- Pure `generateShareCode()` (6-char alphanumeric, ambiguous chars excluded) with collision retry — **unit tested**.
- Server actions / route handlers: `createTrip`, `joinTrip(shareCode, displayName)`, `getTrip(shareCode)`.
- Route structure: `/` (landing/create), `/t/[code]` (group view), `/t/[code]/join` (join). Replace the dev-panel `screen` state machine with real routes; keep the phone-frame shell and `DevPanel` for desktop dev.
- Wire `Create`, `Share`, `Join`, and the member-list part of `Group` to live Supabase data + a realtime subscription on `participants`.
- Add **Vitest** as the test runner (first tests land here).

**Done when:** two browsers/devices join the same code and see each other appear in real time.

---

## Phase 2 — Geolocation capture + live positions (the reality-check spike)

**Delivers:** Joined participants stream their real position; everyone sees real coordinates update on the group view. Includes the deploy-and-test-on-real-phones spike the README calls for.

**Scope:**
- **Spike first:** deploy Phase 1 + a minimal `watchPosition` writer to Vercel; test on iOS Safari and Android Chrome, screen on and off. Record findings (background throttling, permission UX) in this roadmap before building further. This decides whether a PWA/service-worker is needed and what update cadence is realistic.
- `useGeolocation` hook wrapping `navigator.geolocation.watchPosition` with permission handling and a graceful denied/unsupported state.
- Update throttling: write to Supabase every **20–30s**, plus an extra write on significant movement (distance threshold). Pure throttle/`shouldUpdate(prev, next)` logic — **unit tested**.
- `updatePosition` server action; update `lastSeenAt` on every write.
- Group view renders real positions; the "Horizon" viz consumes real distance-to-destination.
- Permission-priming UI on the Join screen ("Allow location to share with your group").

**Done when:** a moving phone's position visibly updates for other members within ~30s.

---

## Phase 3 — Status engine

**Delivers:** Automatic, correct status for every member: With Group / Ahead / Behind / Stopped / Arrived.

**Scope (all pure, heavily unit-tested):**
- `haversine(a, b)` distance in metres.
- `computeStatuses(participants[], destination?, now)` returning `{ id, status, kmLeft }[]`.
  - **With Group:** within ~100m of the group centroid/median.
  - **Ahead / Behind:** progress vs. group median along the route proxy. With a destination, use distance-to-destination; without one, use distance from the start centroid. (Resolves the README's "ahead/behind derives from kmLeft alone" gap.)
  - **Stopped:** no significant movement for ≥5 min (needs `lastMovedAt` per participant — add column).
  - **Arrived:** within destination radius; only when a destination exists.
- No-destination fallback: use members' centroid as the group reference (README known issue).
- Replace all hardcoded `status`/`kmLeft` mock data; compute client-side from the live participant list.

**Done when:** statuses match reality in a manual two-device walk test, and the engine has full unit coverage of each status transition.

---

## Phase 4 — Real map

**Delivers:** The stylized SVG map becomes a real map with member pins + destination pin.

**Scope:**
- MapLibre GL JS + OpenStreetMap raster tiles (no Mapbox token needed; revisit if tile limits bite).
- Member pins (colored by status) + destination pin; recenters/fits to members.
- Lazy-load the map (dynamic import) so it doesn't bloat the status-first experience. Map stays secondary to statuses per the PRD.

**Done when:** real pins render at real coordinates and update live.

---

## Phase 5 — Notifications

**Delivers:** Optional browser notifications for meaningful status changes.

**Scope:**
- Notification permission opt-in (never auto-prompt on load).
- Diff successive status snapshots; fire on transitions: "X has arrived", "X is now behind the group", "Everyone has arrived", "N members are waiting". Pure `diffStatuses(prev, next)` — **unit tested**.
- Reuse the existing in-app toast for foreground; Notification API for background-eligible cases.

**Done when:** arriving/falling-behind on one device notifies another.

---

## Phase 6 — Trip lifecycle, privacy & PWA

**Delivers:** The privacy promise is real — trips expire, data is deleted, members can leave, creator can end the trip.

**Scope:**
- 8h expiry: `expiresAt` enforced in queries (expired trips read as ended); Supabase scheduled function (pg_cron / Edge Function) nulls positions and deletes participant rows after expiry.
- Manual "End Trip" (creator) → `Ended` screen for all members.
- "Leave Trip" removes the participant row.
- RLS hardening: no reads/writes to expired or ended trips.
- PWA manifest + install prompt (now that geolocation behavior from Phase 2 is understood). Add-to-home-screen guidance already drafted in the prototype's Create screen.
- Visible keyboard focus rings before shipping (README known issue).

**Done when:** an expired trip is unreadable and its location data is gone; leaving and ending both work end-to-end.

---

## Test runner

Vitest is introduced in Phase 1 and is the home for all pure-logic tests (share code, throttle, haversine, status engine, status diffing). UI/Supabase integration is verified by running the app (`npm run dev`) and, from Phase 2, on real deployed devices.

## Tracking

As each phase starts, write its detailed bite-sized plan as `docs/superpowers/plans/2026-06-14-phase-N-<name>.md` and link it above. Update the Phase 2 spike findings inline here — they may reshape Phases 4–6.
