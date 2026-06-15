"use client";

import { useState } from "react";
import {
  ArrowRight, ArrowLeft, Share2, Copy, MapPin, Flag, Users, Bell, BellOff,
  Check, Plus, X, Navigation, ChevronRight, CornerDownLeft, Wifi,
} from "lucide-react";
import type { Participant, StatusKey } from "@/lib/types";
import { LiveMap, type MapMarker } from "./LiveMap";

// ─── View model ───────────────────────────────────────────────────────────────
// Screens render `Member`s (a presentation view of a Participant). `located` is
// false until a member has shared a position — Feature 1 has no positions yet, so
// status/distance UI is intentionally suppressed until Features 2–3 fill them in.
export interface Member {
  id: string;
  name: string;
  you: boolean;
  located: boolean;
  kmLeft: number;
  status: StatusKey;
  seen: number; // seconds since last seen
  color: string;
}

const AVATAR_PALETTE = [
  "#E8A87C", "#85C7B2", "#C8A2D8", "#F0C674", "#7BA4D0", "#9DD0C0", "#E0A0B0", "#D8B48A",
];

export function colorForId(id: string): string {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function memberFromParticipant(
  p: Participant,
  clientId: string,
  now: number = Date.now()
): Member {
  return {
    id: p.id,
    name: p.displayName,
    you: p.id === clientId,
    located: p.latitude != null && p.longitude != null,
    kmLeft: 0,
    status: p.status ?? "with",
    seen: Math.max(0, Math.floor((now - p.lastSeenAt) / 1000)),
    color: colorForId(p.id),
  };
}

// ─── Design tokens ──────────────────────────────────────────────────────────
export const C = {
  bg: "#0E1116",
  surface: "#161A21",
  surface2: "#1C2129",
  border: "#252B36",
  text: "#ECEAE4",
  muted: "#8B8F97",
  faint: "#5A5F68",
  ahead: "#F5904C",
  behind: "#6B9EFF",
  withg: "#A8C5B5",
  stopped: "#F5C842",
  arrived: "#5BD18A",
};

export const FONT = {
  display: "var(--font-bricolage)",
  body: "var(--font-inter)",
  mono: "var(--font-mono)",
};

const STATUS: Record<StatusKey, { color: string; label: string; hint: string }> = {
  ahead:   { color: C.ahead,   label: "Ahead",      hint: "Closer to destination than the group" },
  behind:  { color: C.behind,  label: "Behind",     hint: "Trailing the group" },
  with:    { color: C.withg,   label: "With group", hint: "Within 100m of the cluster" },
  stopped: { color: C.stopped, label: "Stopped",    hint: "No movement for 5+ min" },
  arrived: { color: C.arrived, label: "Arrived",    hint: "At the destination" },
};

const fmtSeen = (s: number) =>
  s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;

// ─── Small primitives ───────────────────────────────────────────────────────
const StatusDot = ({ s, size = 8, pulse = false }: { s: StatusKey; size?: number; pulse?: boolean }) => (
  <span
    style={{
      width: size, height: size, borderRadius: 999, background: STATUS[s].color,
      boxShadow: `0 0 0 3px ${STATUS[s].color}22`,
      animation: pulse ? "gtpulse 2s ease-in-out infinite" : undefined,
      display: "inline-block", flexShrink: 0,
    }}
  />
);

const StatusPill = ({ s }: { s: StatusKey }) => (
  <span
    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] tracking-wide"
    style={{
      background: `${STATUS[s].color}18`,
      color: STATUS[s].color,
      border: `1px solid ${STATUS[s].color}30`,
    }}
  >
    <StatusDot s={s} size={6} />
    <span style={{ fontFamily: FONT.body, fontWeight: 500 }}>{STATUS[s].label}</span>
  </span>
);

const Avatar = ({ m, size = 36, ring = false }: { m: Member; size?: number; ring?: boolean }) => (
  <div
    className="grid place-items-center font-medium"
    style={{
      width: size, height: size, borderRadius: 999,
      background: m.color, color: "#0E1116",
      fontFamily: FONT.display,
      fontSize: size * 0.42, fontWeight: 600,
      outline: ring ? `2px solid ${C.text}` : "none",
      outlineOffset: 2,
    }}
  >
    {m.name[0]?.toUpperCase() ?? "?"}
  </div>
);

const FakeQR = ({ seed = "KMS4F2" }: { seed?: string }) => {
  const n = 21;
  const hash = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const bit = (i: number) => (((hash >> (i % 31)) ^ (i * 2654435761)) & 1);
  return (
    <div className="grid p-3 rounded-lg" style={{ background: "#fff", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 2 }}>
      {Array.from({ length: n * n }).map((_, i) => {
        const row = Math.floor(i / n);
        const col = i % n;
        const isFinder = (r: number, c: number) =>
          (r < 7 && c < 7) || (r < 7 && c > n - 8) || (r > n - 8 && c < 7);
        const inFinder = isFinder(row, col);
        let on: number = bit(i + row * 3);
        if (inFinder) {
          const localR = row < 7 ? row : n - 1 - row;
          const localC = col < 7 ? col : n - 1 - col;
          on =
            localR === 0 || localR === 6 || localC === 0 || localC === 6 ||
            (localR >= 2 && localR <= 4 && localC >= 2 && localC <= 4)
              ? 1
              : 0;
        }
        return <div key={i} style={{ background: on ? "#0E1116" : "#fff", aspectRatio: "1/1" }} />;
      })}
    </div>
  );
};

// ─── The signature: Group Horizon ───────────────────────────────────────────
const Horizon = ({
  members, total, destinationName,
}: { members: Member[]; total: number; destinationName: string | null }) => {
  const located = members.filter((m) => m.located);
  const sorted = [...located].sort((a, b) => b.kmLeft - a.kmLeft);
  return (
    <div className="w-full py-6 px-1">
      <div
        className="flex items-center justify-between mb-3 px-1"
        style={{ fontFamily: FONT.mono, fontSize: 10, color: C.faint, letterSpacing: "0.08em" }}
      >
        <span>START</span>
        <span>GROUP HORIZON</span>
        <span>{(destinationName ?? "DESTINATION").toUpperCase()}</span>
      </div>
      <div className="relative h-16">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px"
          style={{ background: `linear-gradient(90deg, ${C.border}, ${C.muted}, ${C.arrived})` }} />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <div key={t} className="absolute top-1/2 -translate-y-1/2 w-px h-2"
            style={{ left: `${t * 100}%`, background: C.border }} />
        ))}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{ width: 24, height: 24, borderRadius: 999, background: C.bg, border: `1.5px solid ${C.arrived}` }}>
          <Flag size={11} color={C.arrived} fill={C.arrived} />
        </div>
        {sorted.map((m) => {
          const progress = total > 0 ? 1 - m.kmLeft / total : 0;
          const left = `${Math.max(2, Math.min(94, progress * 96))}%`;
          return (
            <div
              key={m.id}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700"
              style={{ left }}
            >
              <div className="flex flex-col items-center gap-1">
                <Avatar m={m} size={26} ring={m.you} />
                <div
                  className="tnum"
                  style={{
                    fontFamily: FONT.mono, fontSize: 9, color: C.muted,
                    whiteSpace: "nowrap", position: "absolute", top: 30,
                  }}
                >
                  {m.kmLeft < 0.5 ? "✓" : `${m.kmLeft.toFixed(1)}km`}
                </div>
                <div style={{ position: "absolute", top: -10 }}>
                  <StatusDot s={m.status} size={5} pulse={m.status === "ahead" || m.status === "behind"} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const HorizonPlaceholder = ({ destinationName }: { destinationName: string | null }) => (
  <div className="w-full py-6 px-1">
    <div className="flex items-center justify-between mb-3 px-1"
      style={{ fontFamily: FONT.mono, fontSize: 10, color: C.faint, letterSpacing: "0.08em" }}>
      <span>START</span>
      <span>GROUP HORIZON</span>
      <span>{(destinationName ?? "DESTINATION").toUpperCase()}</span>
    </div>
    <div className="relative h-16 grid place-items-center">
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px"
        style={{ background: `linear-gradient(90deg, ${C.border}, ${C.muted}, ${C.arrived})` }} />
      <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.muted, background: C.bg, padding: "0 10px", zIndex: 1 }}>
        Positions appear once members share location
      </span>
    </div>
  </div>
);

// ─── Screen: Landing ────────────────────────────────────────────────────────
export const Landing = ({ onStart, onJoin }: { onStart: () => void; onJoin: () => void }) => (
  <div className="flex flex-col h-full px-6 py-8">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: C.ahead }} />
        <span style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: "-0.02em", color: C.text }}>
          GroupTrack
        </span>
      </div>
      <button className="text-xs" style={{ color: C.muted, fontFamily: FONT.body }}>
        How it works
      </button>
    </div>

    <div className="flex-1 flex flex-col justify-center -mt-8">
      <div className="mb-10">
        <div className="relative h-12 mb-8">
          <div className="absolute left-0 right-0 top-1/2 h-px"
            style={{ background: `linear-gradient(90deg, ${C.border}, ${C.text}40, ${C.arrived})` }} />
          {[0.15, 0.32, 0.5, 0.68, 0.92].map((t, i) => {
            const colors = [C.behind, C.stopped, C.withg, C.ahead, C.arrived];
            return (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
                style={{
                  left: `${t * 100}%`, width: 10, height: 10,
                  background: colors[i], boxShadow: `0 0 0 4px ${colors[i]}22`,
                }}
              />
            );
          })}
        </div>

        <h1
          style={{
            fontFamily: FONT.display, fontSize: 40, lineHeight: 1.02,
            letterSpacing: "-0.035em", color: C.text, fontWeight: 500,
          }}
        >
          Know where<br />everyone is.<br />
          <span style={{ color: C.muted }}>Without the calls.</span>
        </h1>
      </div>

      <p style={{ fontFamily: FONT.body, color: C.muted, fontSize: 15, lineHeight: 1.5, marginBottom: 32 }}>
        Temporary location sharing for groups moving together. No accounts. No app to install. Expires in 8 hours.
      </p>

      <button
        onClick={onStart}
        className="w-full py-4 rounded-xl flex items-center justify-between px-5 mb-3 transition-transform active:scale-[0.98]"
        style={{ background: C.text, color: C.bg, fontFamily: FONT.body, fontWeight: 600, fontSize: 15 }}
      >
        Start a trip
        <ArrowRight size={18} />
      </button>
      <button
        onClick={onJoin}
        className="w-full py-4 rounded-xl flex items-center justify-between px-5 transition-transform active:scale-[0.98]"
        style={{
          background: "transparent", color: C.text, border: `1px solid ${C.border}`,
          fontFamily: FONT.body, fontWeight: 500, fontSize: 15,
        }}
      >
        Join with a code
        <CornerDownLeft size={18} color={C.muted} />
      </button>
    </div>

    <div className="text-center" style={{ fontFamily: FONT.mono, fontSize: 10, color: C.faint, letterSpacing: "0.1em" }}>
      v0.1 · GROUPTRACK
    </div>
  </div>
);

// ─── Screen: Create ─────────────────────────────────────────────────────────
export const Create = ({
  onBack, onCreate, busy = false,
}: {
  onBack: () => void;
  onCreate: (input: {
    name?: string;
    destinationName?: string;
    destinationLat?: number;
    destinationLng?: number;
  }) => void;
  busy?: boolean;
}) => {
  const [dest, setDest] = useState("");
  const [name, setName] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div className="flex flex-col h-full px-6 py-6 overflow-y-auto">
      <button onClick={onBack} className="self-start mb-8 transition-transform active:scale-[0.92]" style={{ color: C.muted }} aria-label="Back">
        <ArrowLeft size={20} />
      </button>

      <h2 style={{ fontFamily: FONT.display, fontSize: 28, color: C.text, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 8, textWrap: "balance" } as React.CSSProperties}>
        New trip
      </h2>
      <p style={{ fontFamily: FONT.body, color: C.muted, fontSize: 14, marginBottom: 28, textWrap: "pretty" } as React.CSSProperties}>
        Both optional, but a destination unlocks the arrival status and the map.
      </p>

      <label style={{ fontFamily: FONT.mono, fontSize: 10, color: C.faint, letterSpacing: "0.1em" }}>
        DESTINATION
      </label>
      <div className="flex items-center gap-3 py-3 border-b" style={{ borderColor: C.border }}>
        <MapPin size={18} color={C.muted} />
        <input
          value={dest} onChange={(e) => setDest(e.target.value)}
          placeholder="Where to?"
          className="flex-1 bg-transparent outline-none"
          style={{ color: C.text, fontFamily: FONT.body, fontSize: 16 }}
        />
      </div>

      <button
        onClick={() => setShowMap((v) => !v)}
        className="flex items-center gap-2 mt-3 mb-2 self-start transition-transform active:scale-[0.97]"
        style={{ fontFamily: FONT.body, fontSize: 12, color: pin ? C.arrived : C.muted }}
      >
        {pin ? <Check size={14} /> : <MapPin size={14} />}
        {pin ? "Destination pinned · tap to adjust" : "Pin exact spot on map (optional)"}
      </button>

      {showMap && (
        <div className="rounded-xl overflow-hidden mb-4" style={{ height: 220, border: `1px solid ${C.border}` }}>
          <LiveMap markers={[]} destination={pin} onPick={setPin} className="h-full" />
        </div>
      )}

      <label className="mt-2" style={{ fontFamily: FONT.mono, fontSize: 10, color: C.faint, letterSpacing: "0.1em" }}>
        TRIP NAME
      </label>
      <div className="flex items-center gap-3 py-3 mb-8 border-b" style={{ borderColor: C.border }}>
        <Users size={18} color={C.muted} />
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Call it something"
          className="flex-1 bg-transparent outline-none"
          style={{ color: C.text, fontFamily: FONT.body, fontSize: 16 }}
        />
      </div>

      <div className="rounded-lg p-4 mb-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-start gap-3">
          <Wifi size={16} color={C.ahead} className="mt-0.5 shrink-0" />
          <div>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: C.text, fontWeight: 500, marginBottom: 4 }}>
              Keep this tab open while moving
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
              Browsers pause location when the screen is off. Add to home screen for the best experience.
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() =>
          onCreate({
            name: name.trim() || undefined,
            destinationName: dest.trim() || undefined,
            destinationLat: pin?.lat,
            destinationLng: pin?.lng,
          })
        }
        disabled={busy}
        className="w-full py-4 rounded-xl flex items-center justify-between px-5 mt-auto transition-transform active:scale-[0.98] disabled:opacity-60"
        style={{ background: C.text, color: C.bg, fontFamily: FONT.body, fontWeight: 600 }}
      >
        {busy ? "Creating…" : "Create trip"}
        <ArrowRight size={18} />
      </button>
    </div>
  );
};

// ─── Screen: Share ──────────────────────────────────────────────────────────
export const Share = ({
  shareCode, shareUrl, members, onBack, onOpen,
}: {
  shareCode: string;
  shareUrl: string;
  members: Member[];
  onBack: () => void;
  onOpen: () => void;
}) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* clipboard may be blocked; the link is still visible on screen */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Join my trip on GroupTrack", url: shareUrl }); } catch { /* cancelled */ }
    } else {
      copy();
    }
  };

  return (
    <div className="flex flex-col h-full px-6 py-6">
      <button onClick={onBack} className="self-start mb-6" style={{ color: C.muted }} aria-label="Back">
        <ArrowLeft size={20} />
      </button>

      <h2 style={{ fontFamily: FONT.display, fontSize: 28, color: C.text, fontWeight: 500, letterSpacing: "-0.02em" }}>
        Share with the group
      </h2>
      <p style={{ fontFamily: FONT.body, color: C.muted, fontSize: 14, marginBottom: 24 }}>
        Anyone with the link or code can join. Expires in 8 hours.
      </p>

      <div className="mx-auto" style={{ width: 200 }}>
        <FakeQR seed={shareCode} />
      </div>

      <div className="text-center my-6">
        <div style={{ fontFamily: FONT.mono, fontSize: 11, color: C.faint, letterSpacing: "0.15em", marginBottom: 6 }}>
          OR ENTER CODE
        </div>
        <div className="tnum" style={{ fontFamily: FONT.display, fontSize: 36, letterSpacing: "0.08em", color: C.text, fontWeight: 500 }}>
          {shareCode}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={copy}
          className="flex-1 py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.97]"
          style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, fontFamily: FONT.body, fontSize: 14 }}
        >
          {copied ? <Check size={16} color={C.arrived} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          onClick={share}
          className="flex-1 py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.97]"
          style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, fontFamily: FONT.body, fontSize: 14 }}
        >
          <Share2 size={16} /> Share
        </button>
      </div>

      <div className="rounded-lg p-4 mb-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontFamily: FONT.mono, fontSize: 10, color: C.faint, letterSpacing: "0.1em" }}>
            JOINED
          </span>
          <span className="tnum" style={{ fontFamily: FONT.mono, fontSize: 11, color: C.muted }}>
            {members.length} {members.length === 1 ? "person" : "people"}
          </span>
        </div>
        <div className="flex -space-x-2 items-center">
          {members.map((m) => (
            <div key={m.id} style={{ outline: `2px solid ${C.surface}` }} className="rounded-full">
              <Avatar m={m} size={32} ring={m.you} />
            </div>
          ))}
          {members.length === 0 && (
            <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.muted }}>
              Waiting for people to join…
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onOpen}
        className="w-full py-4 rounded-xl flex items-center justify-between px-5 mt-auto transition-transform active:scale-[0.98]"
        style={{ background: C.text, color: C.bg, fontFamily: FONT.body, fontWeight: 600 }}
      >
        Open group view
        <ArrowRight size={18} />
      </button>
    </div>
  );
};

// ─── Screen: Join ───────────────────────────────────────────────────────────
export const Join = ({
  prefilledCode = "", tripName, onBack, onJoin, busy = false, error,
}: {
  prefilledCode?: string;
  tripName?: string | null;
  onBack: () => void;
  onJoin: (input: { code: string; name: string }) => void;
  busy?: boolean;
  error?: string | null;
}) => {
  const [code, setCode] = useState(prefilledCode);
  const [name, setName] = useState("");
  const codeLocked = prefilledCode.length > 0;
  const step = !code ? 0 : !name ? 1 : 2;

  return (
    <div className="flex flex-col h-full px-6 py-6">
      <button onClick={onBack} className="self-start mb-8" style={{ color: C.muted }} aria-label="Back">
        <ArrowLeft size={20} />
      </button>

      <h2 style={{ fontFamily: FONT.display, fontSize: 28, color: C.text, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 8 }}>
        {tripName ? `Join "${tripName}"` : "Join a trip"}
      </h2>

      <label style={{ fontFamily: FONT.mono, fontSize: 10, color: C.faint, letterSpacing: "0.1em", marginTop: 32 }}>
        TRIP CODE
      </label>
      <input
        value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="e.g. KMS4F2"
        disabled={codeLocked}
        className="bg-transparent outline-none py-3 border-b disabled:opacity-70"
        style={{ color: C.text, fontFamily: FONT.display, fontSize: 22, letterSpacing: "0.05em", borderColor: C.border }}
      />

      {step >= 1 && (
        <>
          <label style={{ fontFamily: FONT.mono, fontSize: 10, color: C.faint, letterSpacing: "0.1em", marginTop: 28 }}>
            YOUR NAME
          </label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="So the group knows who you are"
            autoFocus={codeLocked}
            className="bg-transparent outline-none py-3 border-b"
            style={{ color: C.text, fontFamily: FONT.body, fontSize: 16, borderColor: C.border }}
          />
        </>
      )}

      {step >= 2 && (
        <div className="mt-8 rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-start gap-3">
            <MapPin size={18} color={C.ahead} className="mt-0.5" />
            <div>
              <div style={{ fontFamily: FONT.body, fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 4 }}>
                Location sharing comes next
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                Shared only with people in this trip. Stops when the trip ends or you leave. Nothing is stored after.
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: C.ahead, marginTop: 16 }}>{error}</div>
      )}

      <button
        onClick={() => { if (step >= 2 && !busy) onJoin({ code, name: name.trim() }); }}
        disabled={step < 2 || busy}
        className="w-full py-4 rounded-xl flex items-center justify-between px-5 mt-auto transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
        style={{
          background: step >= 2 ? C.text : C.surface,
          color: step >= 2 ? C.bg : C.text,
          border: step >= 2 ? "none" : `1px solid ${C.border}`,
          fontFamily: FONT.body, fontWeight: 600,
        }}
      >
        {busy ? "Joining…" : step === 0 ? "Enter a code" : step === 1 ? "Add your name" : "Join trip"}
        <ArrowRight size={18} />
      </button>
    </div>
  );
};

// ─── Screen: Group ──────────────────────────────────────────────────────────
export type LocationNotice = "denied" | "unsupported" | "locating" | null;

export const Group = ({
  tripName, destinationName, members, lastUpdate, isCreator,
  locationNotice = null, canDemo = false, onStartDemo,
  notifsOn = false, onToggleNotifs,
  onSelectMember, onOpenMap, onLeave, onEnd, onInvite,
}: {
  tripName: string | null;
  destinationName: string | null;
  members: Member[];
  lastUpdate?: number;
  isCreator: boolean;
  locationNotice?: LocationNotice;
  canDemo?: boolean;
  onStartDemo?: () => void;
  notifsOn?: boolean;
  onToggleNotifs?: () => void;
  onSelectMember: (id: string) => void;
  onOpenMap: () => void;
  onLeave: () => void;
  onEnd: () => void;
  onInvite: () => void;
}) => {
  const anyLocated = members.some((m) => m.located);
  const order: StatusKey[] = ["arrived", "ahead", "with", "stopped", "behind"];
  const sorted = [...members].sort((a, b) => {
    if (a.located !== b.located) return a.located ? -1 : 1;
    return order.indexOf(a.status) - order.indexOf(b.status);
  });
  const totalKm = Math.max(1, ...members.filter((m) => m.located).map((m) => m.kmLeft));

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.ahead }} />
            <span className="tnum" style={{ fontFamily: FONT.mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em" }}>
              {lastUpdate != null ? `LIVE · ${lastUpdate}s` : "LIVE"}
            </span>
          </div>
          <h2 style={{ fontFamily: FONT.display, fontSize: 22, color: C.text, fontWeight: 500, letterSpacing: "-0.02em" }}>
            {tripName || "Your trip"}
          </h2>
          <div className="tnum" style={{ fontFamily: FONT.body, fontSize: 13, color: C.muted }}>
            {members.length} {members.length === 1 ? "person" : "people"}{destinationName ? ` · → ${destinationName}` : ""}
          </div>
        </div>
        <button
          onClick={onToggleNotifs}
          className="grid place-items-center rounded-full transition-transform active:scale-[0.9]"
          style={{ width: 40, height: 40, color: notifsOn ? C.text : C.muted }}
          aria-label={notifsOn ? "Turn off alerts" : "Turn on alerts"}
          aria-pressed={notifsOn}
        >
          {notifsOn ? <Bell size={19} /> : <BellOff size={19} />}
        </button>
      </div>

      {locationNotice && (
        <div
          className="mx-5 mt-1 mb-1 rounded-lg px-3 py-2 flex items-center gap-2"
          style={{
            background: locationNotice === "denied" ? `${C.ahead}14` : C.surface,
            border: `1px solid ${locationNotice === "denied" ? `${C.ahead}33` : C.border}`,
          }}
        >
          <MapPin size={14} color={locationNotice === "denied" ? C.ahead : C.muted} className="shrink-0" />
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: locationNotice === "denied" ? C.text : C.muted, lineHeight: 1.4 }}>
            {locationNotice === "locating" && "Finding your location…"}
            {locationNotice === "denied" && "Location is blocked. Enable it in your browser to share your position."}
            {locationNotice === "unsupported" && "This browser can’t share location."}
          </span>
        </div>
      )}

      {anyLocated
        ? <Horizon members={members} total={totalKm} destinationName={destinationName} />
        : <HorizonPlaceholder destinationName={destinationName} />}

      {anyLocated && (
        <div className="px-5 mb-4 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {order.map((s) => {
            const count = members.filter((m) => m.located && m.status === s).length;
            if (count === 0) return null;
            return (
              <div key={s} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <StatusDot s={s} size={6} />
                <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.text }}>
                  {count} {STATUS[s].label.toLowerCase()}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: C.faint, letterSpacing: "0.1em", marginBottom: 10 }}>
          MEMBERS
        </div>
        <div className="flex flex-col gap-2">
          {sorted.map((m, i) => (
            <button
              key={m.id}
              onClick={() => onSelectMember(m.id)}
              className="gt-rise flex items-center gap-3 p-3 rounded-xl text-left transition-[background-color,transform] hover:bg-white/5 active:scale-[0.99]"
              style={{ background: C.surface, border: `1px solid ${C.border}`, animationDelay: `${i * 45}ms` }}
            >
              <Avatar m={m} size={42} ring={m.you} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontFamily: FONT.body, fontSize: 15, color: C.text, fontWeight: 500 }}>
                    {m.name}
                  </span>
                  {m.you && (
                    <span style={{ fontFamily: FONT.mono, fontSize: 9, color: C.faint, letterSpacing: "0.1em" }}>
                      YOU
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {m.located ? (
                    <>
                      <StatusPill s={m.status} />
                      <span className="tnum" style={{ fontFamily: FONT.mono, fontSize: 11, color: C.muted }}>
                        {m.kmLeft < 0.5 ? "at destination" : `${m.kmLeft.toFixed(1)} km left`}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.muted }}>
                      Joined · sharing location soon
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} color={C.faint} />
            </button>
          ))}
        </div>

        <button
          className="w-full mt-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          style={{ background: "transparent", color: C.muted, border: `1px dashed ${C.border}`, fontFamily: FONT.body, fontSize: 13 }}
          onClick={onInvite}
        >
          <Plus size={14} /> Invite more
        </button>

        {canDemo && onStartDemo && (
          <button
            className="w-full mt-2 py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            style={{ background: C.surface, color: C.muted, border: `1px solid ${C.border}`, fontFamily: FONT.body, fontSize: 13 }}
            onClick={onStartDemo}
          >
            <Navigation size={14} /> Preview with a demo convoy
          </button>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-3"
        style={{ background: `linear-gradient(180deg, transparent, ${C.bg} 30%)` }}>
        <div className="flex gap-2">
          <button
            className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2"
            style={{ background: C.surface2, color: C.text, fontFamily: FONT.body, fontSize: 14, fontWeight: 500, border: `1px solid ${C.border}` }}
            aria-current="page"
          >
            <Users size={16} /> Group
          </button>
          <button
            onClick={onOpenMap}
            className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.97]"
            style={{ background: C.surface, color: C.muted, fontFamily: FONT.body, fontSize: 14, border: `1px solid ${C.border}` }}
          >
            <Navigation size={16} /> Map
          </button>
          <button
            onClick={isCreator ? onEnd : onLeave}
            className="px-4 py-3 rounded-xl transition-transform active:scale-[0.95]"
            style={{ background: C.surface, color: C.behind, fontFamily: FONT.body, fontSize: 14, border: `1px solid ${C.border}` }}
          >
            {isCreator ? "End" : "Leave"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Screen: Member ─────────────────────────────────────────────────────────
const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
    <div style={{ fontFamily: FONT.mono, fontSize: 9, color: C.faint, letterSpacing: "0.1em", marginBottom: 4 }}>
      {label}
    </div>
    <div className="tnum" style={{ fontFamily: FONT.display, fontSize: 18, color: C.text, fontWeight: 500 }}>
      {value}
    </div>
  </div>
);

export const MemberView = ({ member, onBack }: { member: Member; onBack: () => void }) => {
  const m = member;
  return (
    <div className="flex flex-col h-full px-5 py-5">
      <button onClick={onBack} className="self-start mb-6" style={{ color: C.muted }} aria-label="Back">
        <ArrowLeft size={20} />
      </button>

      <div className="flex flex-col items-center text-center mb-8">
        <Avatar m={m} size={72} ring={m.you} />
        <h2 style={{ fontFamily: FONT.display, fontSize: 26, color: C.text, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 16 }}>
          {m.name}
          {m.you && <span style={{ color: C.faint, fontSize: 14, marginLeft: 8 }}>· you</span>}
        </h2>
        {m.located ? (
          <>
            <div className="mt-2"><StatusPill s={m.status} /></div>
            <p style={{ fontFamily: FONT.body, fontSize: 13, color: C.muted, marginTop: 8 }}>
              {STATUS[m.status].hint}
            </p>
          </>
        ) : (
          <p style={{ fontFamily: FONT.body, fontSize: 13, color: C.muted, marginTop: 10 }}>
            Hasn&apos;t shared location yet
          </p>
        )}
      </div>

      {m.located && (
        <div className="grid grid-cols-2 gap-2 mb-6">
          <Stat label="DIST TO DEST" value={m.kmLeft < 0.5 ? "0.0 km" : `${m.kmLeft.toFixed(1)} km`} />
          <Stat label="LAST PING" value={fmtSeen(m.seen)} />
        </div>
      )}

      <div style={{ fontFamily: FONT.mono, fontSize: 10, color: C.faint, letterSpacing: "0.1em", marginBottom: 10 }}>
        ACTIVITY
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-1.5"><StatusDot s="with" size={7} /></div>
          <div className="flex-1">
            <div style={{ fontFamily: FONT.body, fontSize: 14, color: C.text }}>Joined the group</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11, color: C.muted }}>{fmtSeen(m.seen)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Screen: Map ─────────────────────────────────────────────────────────────
export const MapView = ({
  members, rawMembers, destination, destinationName, onBack,
}: {
  members: Member[];
  rawMembers: Participant[];
  destination: { lat: number; lng: number } | null;
  destinationName: string | null;
  onBack: () => void;
}) => {
  const byId = new Map(members.map((m) => [m.id, m]));
  const markers: MapMarker[] = rawMembers
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => {
      const m = byId.get(p.id);
      return {
        id: p.id,
        lat: p.latitude as number,
        lng: p.longitude as number,
        color: m?.color ?? C.muted,
        label: (m?.name ?? p.displayName)[0]?.toUpperCase() ?? "?",
        you: m?.you,
      };
    });

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <button onClick={onBack} style={{ color: C.text }} aria-label="Back" className="transition-transform active:scale-[0.92]">
          <ArrowLeft size={20} />
        </button>
        <span style={{ fontFamily: FONT.display, fontSize: 18, color: C.text, fontWeight: 500 }}>Map</span>
        <div style={{ width: 20 }} />
      </div>

      <div className="flex-1 relative overflow-hidden mx-4 rounded-2xl"
        style={{ border: `1px solid ${C.border}` }}>
        <LiveMap markers={markers} destination={destination} className="absolute inset-0" />

        {markers.length === 0 && (
          <div className="absolute inset-x-3 top-3 rounded-xl p-3 flex items-center gap-2 z-10"
            style={{ background: `${C.surface}ee`, border: `1px solid ${C.border}`, backdropFilter: "blur(8px)" }}>
            <Navigation size={14} color={C.muted} className="shrink-0" />
            <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.muted }}>
              Pins appear once members share their location.
            </span>
          </div>
        )}

        {destinationName && (
          <div className="absolute bottom-3 left-3 right-3 rounded-xl p-3 flex items-center justify-between z-10"
            style={{ background: `${C.surface}ee`, border: `1px solid ${C.border}`, backdropFilter: "blur(8px)" }}>
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: C.faint, letterSpacing: "0.1em" }}>DESTINATION</div>
              <div style={{ fontFamily: FONT.body, fontSize: 14, color: C.text, fontWeight: 500 }}>{destinationName}</div>
            </div>
            <Flag size={18} color={C.arrived} />
          </div>
        )}
      </div>

      <div className="p-4">
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, fontFamily: FONT.body, fontSize: 14 }}
        >
          <Users size={16} /> Back to group
        </button>
      </div>
    </div>
  );
};

// ─── Screen: Ended ──────────────────────────────────────────────────────────
export const Ended = ({
  memberCount, onRestart,
}: { memberCount: number; onRestart: () => void }) => (
  <div className="flex flex-col h-full px-6 py-10 items-center text-center">
    <div className="grid place-items-center mb-6"
      style={{ width: 72, height: 72, borderRadius: 999, background: `${C.arrived}1a`, border: `1px solid ${C.arrived}40` }}>
      <Check size={32} color={C.arrived} />
    </div>
    <h2 style={{ fontFamily: FONT.display, fontSize: 28, color: C.text, fontWeight: 500, letterSpacing: "-0.02em" }}>
      Trip ended
    </h2>
    <p style={{ fontFamily: FONT.body, fontSize: 14, color: C.muted, marginTop: 8, maxWidth: 280 }}>
      Locations have stopped updating. Trip data is no longer shared.
    </p>

    <div className="grid grid-cols-1 gap-2 w-full my-8 max-w-[200px]">
      <Stat label="MEMBERS" value={String(memberCount)} />
    </div>

    <button
      onClick={onRestart}
      className="w-full py-4 rounded-xl flex items-center justify-between px-5 mt-auto transition-transform active:scale-[0.98]"
      style={{ background: C.text, color: C.bg, fontFamily: FONT.body, fontWeight: 600 }}
    >
      Start a new trip <ArrowRight size={18} />
    </button>
  </div>
);

// ─── Toast ──────────────────────────────────────────────────────────────────
export const Toast = ({ text, s, onClose }: { text: string; s: StatusKey; onClose: () => void }) => (
  <div className="gt-rise absolute top-4 left-4 right-4 z-30 rounded-xl p-3 flex items-center gap-3"
    style={{ background: C.surface2, border: `1px solid ${C.border}`, boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }}>
    <Bell size={16} color={STATUS[s].color} />
    <div className="flex-1" style={{ fontFamily: FONT.body, fontSize: 13, color: C.text }}>
      {text}
    </div>
    <button onClick={onClose} style={{ color: C.muted }} aria-label="Dismiss">
      <X size={14} />
    </button>
  </div>
);
