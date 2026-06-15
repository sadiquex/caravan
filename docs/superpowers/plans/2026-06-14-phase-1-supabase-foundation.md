# Phase 1 — Supabase Foundation + Trip Create/Join Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create real, auto-expiring trips backed by Supabase — generate a real share code, join by link with a name, and see the participant list update live on every device. No location yet.

**Architecture:** A browser-side Supabase client handles all data + Realtime. Identity is a per-browser `clientId` UUID in `localStorage` (no accounts). Trips and participants live in two tables; RLS is enabled but intentionally permissive for the MVP (tightened in Phase 6). The prototype's `screen` state machine is replaced by real Next.js routes (`/`, `/t/[code]`, `/t/[code]/join`), reusing the existing screen components and visual shell.

**Tech Stack:** Next.js 14 App Router, TypeScript, `@supabase/supabase-js`, Supabase Postgres + Realtime, Vitest.

**Prerequisite (human step):** Create a Supabase project at supabase.com and have the Project URL + anon key ready. The SQL in Task 3 is run once in the Supabase SQL editor.

---

### Task 1: Add the Vitest test runner

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/__tests__/sanity.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add the test script**

In `package.json` `scripts`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write a sanity test**

```ts
// lib/__tests__/sanity.test.ts
import { describe, it, expect } from "vitest";

describe("test runner", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS, 1 test passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/__tests__/sanity.test.ts
git commit -m "chore: add vitest test runner"
```

---

### Task 2: Share-code generator (pure, TDD)

**Files:**
- Create: `lib/shareCode.ts`
- Test: `lib/__tests__/shareCode.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/__tests__/shareCode.test.ts
import { describe, it, expect } from "vitest";
import { generateShareCode, SHARE_CODE_ALPHABET } from "../shareCode";

describe("generateShareCode", () => {
  it("is 6 characters long", () => {
    expect(generateShareCode()).toHaveLength(6);
  });

  it("only uses the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      for (const ch of generateShareCode()) {
        expect(SHARE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("excludes ambiguous characters 0 O 1 I", () => {
    expect(SHARE_CODE_ALPHABET).not.toMatch(/[0O1I]/);
  });

  it("is reasonably non-repeating across calls", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateShareCode()));
    expect(codes.size).toBeGreaterThan(490);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/__tests__/shareCode.test.ts`
Expected: FAIL — cannot find module `../shareCode`.

- [ ] **Step 3: Implement**

```ts
// lib/shareCode.ts
// Crockford-ish alphabet: no 0/O/1/I to avoid read-aloud confusion.
export const SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateShareCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * SHARE_CODE_ALPHABET.length);
    out += SHARE_CODE_ALPHABET[idx];
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/__tests__/shareCode.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/shareCode.ts lib/__tests__/shareCode.test.ts
git commit -m "feat: add unambiguous 6-char share code generator"
```

---

### Task 3: Database schema + RLS (run in Supabase)

**Files:**
- Create: `supabase/schema.sql` (source of truth, committed; also pasted into the Supabase SQL editor)

- [ ] **Step 1: Write the schema file**

```sql
-- supabase/schema.sql
-- GroupTrack Phase 1 schema. Run in the Supabase SQL editor.
-- RLS is enabled but permissive for the MVP; Phase 6 tightens it.

create extension if not exists pgcrypto;

create table if not exists trips (
  id                   uuid primary key default gen_random_uuid(),
  share_code           text unique not null,
  name                 text,
  destination_name     text,
  destination_lat      double precision,
  destination_lng      double precision,
  creator_id           text not null,            -- per-browser clientId, no accounts
  ended_at             timestamptz,
  expires_at           timestamptz not null default (now() + interval '8 hours'),
  created_at           timestamptz not null default now()
);

create table if not exists participants (
  id            text not null,                    -- per-browser clientId
  trip_id       uuid not null references trips(id) on delete cascade,
  display_name  text not null,
  latitude      double precision,
  longitude     double precision,
  status        text,
  last_moved_at timestamptz,                       -- used by the Phase 3 status engine
  last_seen_at  timestamptz not null default now(),
  primary key (trip_id, id)
);

create index if not exists participants_trip_id_idx on participants(trip_id);

alter table trips enable row level security;
alter table participants enable row level security;

-- Permissive MVP policies (anon key). Tightened in Phase 6.
create policy "trips_anon_all" on trips for all
  to anon using (true) with check (true);
create policy "participants_anon_all" on participants for all
  to anon using (true) with check (true);

-- Realtime: broadcast participant changes.
alter publication supabase_realtime add table participants;
```

- [ ] **Step 2: Run it in Supabase**

Paste `supabase/schema.sql` into the Supabase SQL editor and run. Verify in Table editor that `trips` and `participants` exist and Realtime is enabled for `participants` (Database → Replication).

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add trips + participants schema with RLS and realtime"
```

---

### Task 4: Supabase browser client + env

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `.env.local` (NOT committed — already covered by `.gitignore`)
- Create: `.env.example`
- Modify: `lib/supabase/client.ts` consumers later

- [ ] **Step 1: Install the SDK**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Create `.env.example`**

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 3: Create `.env.local` with real values**

Copy `.env.example` to `.env.local` and fill in the real Project URL + anon key from the Supabase dashboard. Confirm `.env*.local` is gitignored (the default Next.js `.gitignore` covers it — verify before continuing).

- [ ] **Step 4: Create the client**

```ts
// lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local."
  );
}

export const supabase = createClient(url, anonKey);
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/supabase/client.ts .env.example
git commit -m "feat: add supabase browser client and env config"
```

---

### Task 5: Per-browser client identity

**Files:**
- Create: `lib/clientId.ts`
- Test: `lib/__tests__/clientId.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/clientId.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("getClientId", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-1111-1111-111111111111" });
  });

  it("creates and persists an id", async () => {
    const { getClientId } = await import("../clientId");
    const first = getClientId();
    expect(first).toBe("11111111-1111-1111-1111-111111111111");
    expect(getClientId()).toBe(first);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/__tests__/clientId.test.ts`
Expected: FAIL — cannot find module `../clientId`.

- [ ] **Step 3: Implement**

```ts
// lib/clientId.ts
const KEY = "grouptrack:clientId";

export function getClientId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/__tests__/clientId.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/clientId.ts lib/__tests__/clientId.test.ts
git commit -m "feat: add per-browser client identity"
```

---

### Task 6: Trip data-access layer

**Files:**
- Create: `lib/trips.ts`

This layer is the only place that talks to Supabase tables. (Logic here depends on a live DB, so it is verified by running the app in Task 8/9 rather than unit-tested.)

- [ ] **Step 1: Define shared types**

```ts
// lib/types.ts
export type StatusKey = "ahead" | "behind" | "with" | "stopped" | "arrived";

export interface Trip {
  id: string;
  share_code: string;
  name: string | null;
  destination_name: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  creator_id: string;
  ended_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Participant {
  id: string;
  trip_id: string;
  display_name: string;
  latitude: number | null;
  longitude: number | null;
  status: StatusKey | null;
  last_moved_at: string | null;
  last_seen_at: string;
}
```

- [ ] **Step 2: Implement the data-access functions**

```ts
// lib/trips.ts
import { supabase } from "./supabase/client";
import { generateShareCode } from "./shareCode";
import { getClientId } from "./clientId";
import type { Trip, Participant } from "./types";

export async function createTrip(input: {
  name?: string;
  destinationName?: string;
  destinationLat?: number;
  destinationLng?: number;
}): Promise<Trip> {
  const creatorId = getClientId();

  // Retry on share_code collision (unique constraint -> Postgres code 23505).
  for (let attempt = 0; attempt < 5; attempt++) {
    const share_code = generateShareCode();
    const { data, error } = await supabase
      .from("trips")
      .insert({
        share_code,
        name: input.name || null,
        destination_name: input.destinationName || null,
        destination_lat: input.destinationLat ?? null,
        destination_lng: input.destinationLng ?? null,
        creator_id: creatorId,
      })
      .select()
      .single();

    if (!error) return data as Trip;
    if (error.code !== "23505") throw error; // not a collision -> real error
  }
  throw new Error("Could not generate a unique share code");
}

export async function getTripByCode(shareCode: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from("trips")
    .select()
    .eq("share_code", shareCode.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const trip = data as Trip;
  // Treat expired/ended trips as gone.
  if (trip.ended_at || new Date(trip.expires_at) < new Date()) return null;
  return trip;
}

export async function joinTrip(tripId: string, displayName: string): Promise<Participant> {
  const id = getClientId();
  const { data, error } = await supabase
    .from("participants")
    .upsert(
      { id, trip_id: tripId, display_name: displayName, last_seen_at: new Date().toISOString() },
      { onConflict: "trip_id,id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Participant;
}

export async function listParticipants(tripId: string): Promise<Participant[]> {
  const { data, error } = await supabase
    .from("participants")
    .select()
    .eq("trip_id", tripId)
    .order("display_name");
  if (error) throw error;
  return (data ?? []) as Participant[];
}

// Subscribe to live participant changes for a trip. Returns an unsubscribe fn.
export function subscribeParticipants(tripId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`participants:${tripId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "participants", filter: `trip_id=eq.${tripId}` },
      () => onChange()
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/trips.ts
git commit -m "feat: add trip data-access layer with realtime subscription"
```

---

### Task 7: Route restructure — real pages replace the screen state machine

**Files:**
- Create: `app/(shell)/PhoneShell.tsx` (extract the phone-frame wrapper + DevPanel from `GroupTrack.tsx`)
- Modify: `app/page.tsx` (landing → create flow)
- Create: `app/t/[code]/page.tsx` (group view)
- Create: `app/t/[code]/join/page.tsx` (join view)
- Modify: `app/components/GroupTrack.tsx` (export individual screen components instead of one monolith)

> **Note for the implementer:** The prototype keeps every screen in `app/components/GroupTrack.tsx` behind a `screen` useState. This task splits the *navigation* onto real routes while reusing the existing screen components. Do it incrementally: first export the screen components, then mount them in routes. Keep `DevPanel` available in development only.

- [ ] **Step 1: Export the screen components**

In `app/components/GroupTrack.tsx`, change `Landing`, `Create`, `Share`, `Join`, `Group`, `MemberView`, `MapView`, `Ended`, and the `PhoneShell`/frame markup from module-private `const`s to **named exports** (`export const Landing = ...`). Leave their internals unchanged for now. Keep the default `GroupTrack` export working so the app still runs.

- [ ] **Step 2: Extract the phone-frame shell**

Create `app/(shell)/PhoneShell.tsx` exporting a component that renders the `relative h-screen md:h-[820px]` phone frame (copied from `GroupTrack.tsx`'s wrapper) around `{children}`, plus the `DevPanel` only when `process.env.NODE_ENV !== "production"`.

```tsx
// app/(shell)/PhoneShell.tsx
"use client";
export function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center md:gap-8">
      <div className="relative h-screen w-full max-w-[390px] md:h-[820px] overflow-hidden">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Point `/` at create flow**

```tsx
// app/page.tsx
"use client";
import { useRouter } from "next/navigation";
import { PhoneShell } from "./(shell)/PhoneShell";
import { Landing } from "./components/GroupTrack";

export default function Home() {
  const router = useRouter();
  return (
    <PhoneShell>
      <Landing go={(s) => router.push(s === "create" ? "/?step=create" : "/")} />
    </PhoneShell>
  );
}
```

> The `Create` screen is wired to the real backend in Task 8; this step only restores routing so the app boots after the export change.

- [ ] **Step 4: Add the group + join routes (placeholders wired in later tasks)**

```tsx
// app/t/[code]/page.tsx
"use client";
import { PhoneShell } from "../../(shell)/PhoneShell";
export default function GroupPage() {
  return <PhoneShell><div /></PhoneShell>; // wired in Task 9
}
```

```tsx
// app/t/[code]/join/page.tsx
"use client";
import { PhoneShell } from "../../../(shell)/PhoneShell";
export default function JoinPage() {
  return <PhoneShell><div /></PhoneShell>; // wired in Task 8
}
```

- [ ] **Step 5: Verify the app boots**

Run: `npm run dev`, open http://localhost:3000
Expected: landing screen renders inside the phone shell, no console errors.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx "app/(shell)/PhoneShell.tsx" app/t app/components/GroupTrack.tsx
git commit -m "refactor: replace screen state machine with real routes"
```

---

### Task 8: Wire Create → Share → Join to the backend

**Files:**
- Modify: `app/page.tsx` (host the Create screen + handle create)
- Modify: `app/components/GroupTrack.tsx` (`Create` and `Share` accept data/handlers as props)
- Modify: `app/t/[code]/join/page.tsx`

- [ ] **Step 1: Make `Create` report its inputs**

Change the exported `Create` component's signature so the "Create Trip" button calls a prop `onCreate({ name, destinationName })` instead of `go("share")`. Keep the existing form fields/state.

- [ ] **Step 2: Handle create on `/`**

```tsx
// app/page.tsx  (replace the body)
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneShell } from "./(shell)/PhoneShell";
import { Landing, Create, Share } from "./components/GroupTrack";
import { createTrip } from "@/lib/trips";
import type { Trip } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<"landing" | "create" | "share">("landing");
  const [trip, setTrip] = useState<Trip | null>(null);

  return (
    <PhoneShell>
      {step === "landing" && <Landing go={(s) => setStep(s === "create" ? "create" : "landing")} />}
      {step === "create" && (
        <Create
          go={() => setStep("landing")}
          onCreate={async (input) => {
            const t = await createTrip(input);
            setTrip(t);
            setStep("share");
          }}
        />
      )}
      {step === "share" && trip && (
        <Share
          go={() => router.push(`/t/${trip.share_code}`)}
          shareCode={trip.share_code}
          shareUrl={`${window.location.origin}/t/${trip.share_code}/join`}
        />
      )}
    </PhoneShell>
  );
}
```

- [ ] **Step 3: Make `Share` show the real code + link**

Change the exported `Share` component to accept `shareCode: string` and `shareUrl: string` props, render them (replace the hardcoded `KMS4F2` and fake QR seed with `shareCode`), and make the copy button copy `shareUrl`. The "go to group" button uses the existing `go` prop.

- [ ] **Step 4: Wire the Join page**

```tsx
// app/t/[code]/join/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhoneShell } from "../../../(shell)/PhoneShell";
import { Join } from "../../../components/GroupTrack";
import { getTripByCode, joinTrip } from "@/lib/trips";
import type { Trip } from "@/lib/types";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getTripByCode(code).then((t) => (t ? setTrip(t) : setNotFound(true)));
  }, [code]);

  if (notFound) return <PhoneShell><div className="p-8 text-white">Trip not found or ended.</div></PhoneShell>;
  if (!trip) return <PhoneShell><div className="p-8 text-white">Loading…</div></PhoneShell>;

  return (
    <PhoneShell>
      <Join
        prefilledCode={trip.share_code}
        tripName={trip.name}
        onJoin={async (displayName) => {
          await joinTrip(trip.id, displayName);
          router.push(`/t/${trip.share_code}`);
        }}
      />
    </PhoneShell>
  );
}
```

- [ ] **Step 5: Adapt the `Join` component**

Change the exported `Join` to accept `prefilledCode`, `tripName`, and `onJoin(displayName)`. Pre-fill/lock the code field from `prefilledCode`, and call `onJoin(name)` from the join button instead of `go("group")`. (Location permission is added in Phase 2 — for now joining only needs a name.)

- [ ] **Step 6: Verify end-to-end create + join**

Run: `npm run dev`. Create a trip → land on Share with a real code → open the join URL in a second browser/incognito window → enter a name → join → land on the (empty for now) group route. Check the Supabase Table editor: one `trips` row and one `participants` row exist.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/t app/components/GroupTrack.tsx
git commit -m "feat: wire create, share and join to supabase"
```

---

### Task 9: Live participant list on the Group view

**Files:**
- Modify: `app/t/[code]/page.tsx`
- Modify: `app/components/GroupTrack.tsx` (`Group` accepts a live `members` list)

- [ ] **Step 1: Adapt the `Group` component to real data**

Change the exported `Group` to accept `tripName: string | null`, `members: Participant[]`, and keep its `go` prop. Render member names from `members` and `members.length` for the count. Where the prototype shows a status badge, render `member.status ?? "—"` (statuses are populated in Phase 3; null is expected now). The Horizon viz can stay on placeholder positions until Phase 2/3 — pass it an empty/neutral state if it would crash on null coordinates.

- [ ] **Step 2: Wire the group page with realtime**

```tsx
// app/t/[code]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhoneShell } from "../../(shell)/PhoneShell";
import { Group } from "../../components/GroupTrack";
import { getTripByCode, listParticipants, subscribeParticipants } from "@/lib/trips";
import type { Trip, Participant } from "@/lib/types";

export default function GroupPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<Participant[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    getTripByCode(code).then((t) => {
      if (!t) return setMissing(true);
      setTrip(t);
      const refresh = () => listParticipants(t.id).then(setMembers);
      refresh();
      unsub = subscribeParticipants(t.id, refresh);
    });
    return () => unsub();
  }, [code]);

  if (missing) return <PhoneShell><div className="p-8 text-white">Trip not found or ended.</div></PhoneShell>;
  if (!trip) return <PhoneShell><div className="p-8 text-white">Loading…</div></PhoneShell>;

  return (
    <PhoneShell>
      <Group
        go={(s) => router.push(s === "join" ? `/t/${trip.share_code}/join` : `/t/${trip.share_code}`)}
        tripName={trip.name}
        members={members}
      />
    </PhoneShell>
  );
}
```

- [ ] **Step 3: Verify realtime**

Run: `npm run dev`. Open the group view in browser A. In browser B, open the join URL and join with a new name. Browser A's member list must update **without a refresh** within ~1–2s. Join a third — count goes to 3 live.

- [ ] **Step 4: Typecheck + tests + commit**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all unit tests pass.

```bash
git add app/t app/components/GroupTrack.tsx
git commit -m "feat: live participant list via supabase realtime"
```

---

## Phase 1 Definition of Done

- [ ] Creating a trip stores a `trips` row with a unique 6-char share code.
- [ ] The Share screen shows the real code and a working join URL (`/t/<code>/join`).
- [ ] Opening the join URL on a second device, entering a name, and joining stores a `participants` row.
- [ ] Both devices see the participant list update live (Realtime), no refresh.
- [ ] `npm test` passes (share code, clientId, sanity); `npx tsc --noEmit` is clean.
- [ ] No location is captured yet — `latitude/longitude/status` remain null (that's Phase 2).

When done, write the Phase 2 plan (`docs/superpowers/plans/2026-06-14-phase-2-geolocation.md`) starting with the deploy-to-real-phones geolocation spike.
