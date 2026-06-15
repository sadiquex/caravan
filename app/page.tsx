"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneFrame } from "./components/PhoneFrame";
import { Landing, Create, Share, memberFromParticipant, type Member } from "./components/GroupTrack";
import { data } from "@/lib/data";
import { getClientId } from "@/lib/clientId";
import type { Trip } from "@/lib/types";

type Step = "landing" | "create" | "share";

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("landing");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);

  // While on the Share screen, show people joining live.
  useEffect(() => {
    if (step !== "share" || !trip) return;
    const clientId = getClientId();
    const refresh = () =>
      setMembers(data.listParticipants(trip.id).map((p) => memberFromParticipant(p, clientId)));
    refresh();
    return data.subscribe(trip.id, refresh);
  }, [step, trip]);

  const handleCreate = (input: {
    name?: string;
    destinationName?: string;
    destinationLat?: number;
    destinationLng?: number;
  }) => {
    setBusy(true);
    const created = data.createTrip(input, getClientId());
    setTrip(created);
    setBusy(false);
    setStep("share");
  };

  const shareUrl =
    trip && typeof window !== "undefined" ? `${window.location.origin}/t/${trip.shareCode}/join` : "";

  return (
    <PhoneFrame>
      {step === "landing" && (
        <Landing onStart={() => setStep("create")} onJoin={() => router.push("/join")} />
      )}
      {step === "create" && (
        <Create onBack={() => setStep("landing")} onCreate={handleCreate} busy={busy} />
      )}
      {step === "share" && trip && (
        <Share
          shareCode={trip.shareCode}
          shareUrl={shareUrl}
          members={members}
          onBack={() => setStep("create")}
          onOpen={() => router.push(`/t/${trip.shareCode}`)}
        />
      )}
    </PhoneFrame>
  );
}
