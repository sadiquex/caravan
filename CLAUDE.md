# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GroupTrack — temporary location sharing for groups moving together (no accounts, no install, trips expire in 8h). The full product spec is `docs/PRD.md`; the phased plan is `docs/superpowers/plans/`.

**Current state: the frontend flow is fully functional with a local (localStorage) data layer — no backend yet.** Trips, joining, live member sync, real geolocation, the status engine, the map, and notifications all work in the browser. The backend (Supabase) is deliberately deferred; the data layer is designed to be swapped for it without touching screens.

## Commands

- `npm run dev` — dev server at http://localhost:3000 (Node 18.17+, Node 20 LTS recommended)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint (`next/core-web-vitals`)
- `npm test` — Vitest (pure-logic unit tests)
- `npm run test:watch` — Vitest watch mode
- Run one test file: `npx vitest run lib/__tests__/status.test.ts`

## Architecture

Next.js 14 App Router + TypeScript + Tailwind + MapLibre GL. Navigation is **real routes**, not a state machine:

- `app/page.tsx` — landing → create → share (local step state)
- `app/join/page.tsx` — join by typed code; `app/t/[code]/join/page.tsx` — join by link (both render `app/components/JoinFlow.tsx`)
- `app/t/[code]/page.tsx` — the live group view (the orchestrator: geolocation, status computation, notifications, member/map sub-views)

Key facts that span files / aren't obvious from skimming:

- **Swappable data layer (`lib/data/`).** This is the single most important abstraction. `lib/data/local.ts` is a dependency-injected (storage/genId/genCode/now) localStorage store — fully unit-tested. `lib/data/index.ts` is the browser singleton `data` with cross-tab "realtime" via storage events. The whole app talks only to `data`'s interface (`createTrip/getTripByCode/getTripById/joinTrip/updatePosition/listParticipants/leaveTrip/endTrip/subscribe`). To add the backend, replace `lib/data/index.ts` with a Supabase implementation of that same interface — **screens and routes don't change.**
- **Identity:** `lib/clientId.ts` — a per-browser UUID in localStorage (no accounts). `getClientId()` touches `localStorage`, so only call it on the client (in effects/handlers), never at SSR render time. Everyone, creator included, must be a participant to see the group view — `app/t/[code]/page.tsx` redirects non-members to the join step.
- **Pure logic lives in `lib/` and is TDD'd** (tests in `lib/__tests__/`): `shareCode.ts` (codes), `geo.ts` (`haversineMeters`, `shouldWritePosition` throttle), `status.ts` (`computeStatuses` → ahead/behind/with/stopped/arrived; precedence arrived > stopped > with > ahead/behind; "with group" = near a majority of members, robust to outliers), `notify.ts` (`diffStatuses` → transition messages).
- **`GroupTrack.tsx` is a prop-driven screen library** (no mock data, no dev-panel). Exports each screen plus tokens `C`/`FONT`, the `Member` view-model, and `memberFromParticipant`. **Styling is inline `style={{...}}` referencing `C`/`FONT`**, not Tailwind utilities (Tailwind only maps the font CSS vars + utility classes like `tnum`, `gt-rise`). The `Member` view-model has a `located` flag — when false (no position yet) screens show a "sharing location soon" pre-tracking state instead of fake status.
- **Geolocation:** `app/hooks/useGeolocation.ts` wraps `watchPosition`, manages permission states, and writes throttled positions via `data.updatePosition`. Enabled once you're in the group view.
- **Map:** `app/components/LiveMap.tsx` — MapLibre GL with OSM raster tiles, **dynamically imported inside an effect** (keeps it out of SSR and the initial bundle). Used both for the live map and the tap-to-set destination picker in Create. There is no geocoding (an "integration"); destination coordinates come from the map picker.
- **Demo mode:** `lib/demo.ts` (`startDemoConvoy`) injects scripted members that move toward the destination, so one person can see the whole experience (statuses, map, notifications) solo. Frontend-only showcase; writes through the real `data` layer.

## Working in this codebase

- TDD all pure logic in `lib/`; verify UI/data wiring by running the app. After changes, the bar is: `npx tsc --noEmit` clean, `npm test` green, `npm run build` passes.
- The `gtpulse`/`gtrise` keyframes, focus-visible ring, `tnum` (tabular numbers), and reduced-motion guard live in `app/globals.css`.

See `docs/PRD.md` for the product spec and `docs/superpowers/plans/2026-06-14-grouptrack-roadmap.md` for the remaining backend work (Supabase, expiry job, RLS, PWA).
