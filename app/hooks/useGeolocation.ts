"use client";

import { useEffect, useRef, useState } from "react";
import { data } from "@/lib/data";
import { shouldWritePosition, type LatLng } from "@/lib/geo";

export type GeoStatus = "idle" | "unsupported" | "prompting" | "granted" | "denied" | "error";

interface GeoState {
  status: GeoStatus;
  position: LatLng | null;
  error: string | null;
}

// Streams the current device position into the data layer for `participantId`,
// throttled by shouldWritePosition. Real browser geolocation — no backend needed.
export function useGeolocation({
  tripId,
  participantId,
  enabled,
}: {
  tripId: string | null;
  participantId: string;
  enabled: boolean;
}): GeoState {
  const [state, setState] = useState<GeoState>({ status: "idle", position: null, error: null });
  const lastWritten = useRef<LatLng | null>(null);
  const lastWriteAt = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !tripId || !participantId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "unsupported", position: null, error: null });
      return;
    }

    setState((s) => (s.status === "granted" ? s : { ...s, status: "prompting" }));

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setState({ status: "granted", position: next, error: null });

        const now = Date.now();
        if (
          shouldWritePosition({
            prev: lastWritten.current,
            next,
            msSinceLastWrite: now - lastWriteAt.current,
          })
        ) {
          data.updatePosition(tripId, participantId, next);
          lastWritten.current = next;
          lastWriteAt.current = now;
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ status: "denied", position: null, error: "Location permission denied" });
        } else {
          setState({ status: "error", position: null, error: err.message || "Location unavailable" });
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 27_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, tripId, participantId]);

  return state;
}
