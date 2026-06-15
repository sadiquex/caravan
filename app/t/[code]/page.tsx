"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhoneFrame } from "../../components/PhoneFrame";
import {
  Group, MemberView, MapView, Ended, Toast,
  memberFromParticipant, C, FONT, type Member,
} from "../../components/GroupTrack";
import { useGeolocation } from "../../hooks/useGeolocation";
import { data } from "@/lib/data";
import { getClientId } from "@/lib/clientId";
import { computeStatuses } from "@/lib/status";
import { diffStatuses } from "@/lib/notify";
import { startDemoConvoy } from "@/lib/demo";
import type { Participant, StatusKey, Trip } from "@/lib/types";

type View = { kind: "group" } | { kind: "member"; id: string } | { kind: "map" };
type Load = "loading" | "ready" | "ended";

export default function GroupPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  // clientId touches localStorage, so resolve it on the client only (avoids SSR crash).
  const [clientId, setClientId] = useState("");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [load, setLoad] = useState<Load>("loading");
  const [view, setView] = useState<View>({ kind: "group" });
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [demoOn, setDemoOn] = useState(false);
  const [notifsOn, setNotifsOn] = useState(false);
  const leaving = useRef(false);
  const stopDemo = useRef<() => void>(() => {});
  const prevStatuses = useRef<Record<string, StatusKey> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Stream this device's real position into the trip once we're in.
  const geo = useGeolocation({
    tripId: trip?.id ?? null,
    participantId: clientId,
    enabled: load === "ready",
  });

  useEffect(() => {
    const id = getClientId();
    setClientId(id);

    const found = data.getTripByCode(code);
    if (!found) {
      setLoad("ended");
      return;
    }
    // You must be a participant to view the group — sends creator + link visitors
    // through the name step exactly once.
    const isMember = data.listParticipants(found.id).some((p) => p.id === id);
    if (!isMember) {
      router.replace(`/t/${found.shareCode}/join`);
      return;
    }

    const refresh = () => {
      const live = data.getTripById(found.id); // re-check liveness (expiry / ended elsewhere)
      if (!live) {
        setTrip(null);
        setLoad("ended");
        return;
      }
      setParticipants(data.listParticipants(found.id));
    };

    setTrip(found);
    setLoad("ready");
    refresh();
    const unsub = data.subscribe(found.id, () => {
      if (!leaving.current) refresh();
    });
    return unsub;
  }, [code, router]);

  // Tick so time-based status (stopped, last-seen) stays fresh without new positions.
  useEffect(() => {
    if (load !== "ready") return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => () => stopDemo.current(), []);

  const destination = useMemo(
    () =>
      trip?.destinationLat != null && trip?.destinationLng != null
        ? { lat: trip.destinationLat, lng: trip.destinationLng }
        : null,
    [trip?.destinationLat, trip?.destinationLng]
  );

  const members: Member[] = useMemo(() => {
    const statuses = computeStatuses(participants, destination, now);
    return participants.map((p) => {
      const base = memberFromParticipant(p, clientId, now);
      const s = statuses[p.id];
      return s ? { ...base, status: s.status, kmLeft: s.kmLeft } : base;
    });
  }, [participants, destination, now, clientId]);

  // Surface meaningful status changes — in-app toast always, system notification when opted in.
  useEffect(() => {
    if (load !== "ready") return;
    const located = members.filter((m) => m.located);
    const cur: Record<string, StatusKey> = {};
    const names: Record<string, string> = {};
    for (const m of located) {
      cur[m.id] = m.status;
      names[m.id] = m.you ? "You" : m.name;
    }
    const prev = prevStatuses.current;
    if (prev) {
      const msgs = diffStatuses(prev, cur, names);
      if (msgs.length) {
        flash(msgs[0]);
        if (notifsOn && typeof Notification !== "undefined" && Notification.permission === "granted") {
          msgs.forEach((m) => new Notification("GroupTrack", { body: m }));
        }
      }
    }
    prevStatuses.current = cur;
  }, [members, load, notifsOn, flash]);

  if (load === "loading") {
    return (
      <PhoneFrame>
        <div className="grid place-items-center h-full" style={{ fontFamily: FONT.body, color: C.muted }}>
          Loading…
        </div>
      </PhoneFrame>
    );
  }

  if (load === "ended" || !trip) {
    return (
      <PhoneFrame>
        <Ended memberCount={participants.length} onRestart={() => router.push("/")} />
      </PhoneFrame>
    );
  }

  const isCreator = trip.creatorId === clientId;
  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/t/${trip.shareCode}/join` : "";

  const toggleNotifs = async () => {
    if (notifsOn) {
      setNotifsOn(false);
      return;
    }
    if (typeof Notification === "undefined") {
      flash("Notifications aren’t supported here");
      return;
    }
    const perm =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (perm === "granted") {
      setNotifsOn(true);
      flash("Alerts on");
    } else {
      flash("Allow notifications in your browser to enable alerts");
    }
  };

  const invite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my trip on GroupTrack", url: joinUrl });
        return;
      } catch {
        /* cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(joinUrl);
      flash("Invite link copied");
    } catch {
      flash(`Share code: ${trip.shareCode}`);
    }
  };

  const startDemo = () => {
    if (demoOn) return;
    const origin = geo.position ?? { lat: 5.6037, lng: -0.187 };
    stopDemo.current = startDemoConvoy({ tripId: trip.id, origin, destination });
    setDemoOn(true);
    flash("Demo convoy added");
  };

  const leave = () => {
    leaving.current = true;
    stopDemo.current();
    data.leaveTrip(trip.id, clientId);
    router.push("/");
  };

  const end = () => {
    leaving.current = true;
    stopDemo.current();
    data.endTrip(trip.id);
    setTrip(null);
    setLoad("ended");
  };

  const locationNotice =
    geo.status === "denied"
      ? ("denied" as const)
      : geo.status === "unsupported"
      ? ("unsupported" as const)
      : geo.status === "prompting"
      ? ("locating" as const)
      : null;

  return (
    <PhoneFrame>
      {toast && <Toast text={toast} s="with" onClose={() => setToast(null)} />}

      {view.kind === "group" && (
        <Group
          tripName={trip.name}
          destinationName={trip.destinationName}
          members={members}
          isCreator={isCreator}
          locationNotice={locationNotice}
          notifsOn={notifsOn}
          onToggleNotifs={toggleNotifs}
          canDemo={!demoOn && members.length <= 1}
          onStartDemo={startDemo}
          onSelectMember={(id) => setView({ kind: "member", id })}
          onOpenMap={() => setView({ kind: "map" })}
          onInvite={invite}
          onLeave={leave}
          onEnd={end}
        />
      )}

      {view.kind === "member" && (
        <MemberView
          member={members.find((m) => m.id === view.id) ?? members[0]}
          onBack={() => setView({ kind: "group" })}
        />
      )}

      {view.kind === "map" && (
        <MapView
          members={members}
          rawMembers={participants}
          destination={destination}
          destinationName={trip.destinationName}
          onBack={() => setView({ kind: "group" })}
        />
      )}
    </PhoneFrame>
  );
}
