import { data } from "./data";
import type { LatLng } from "./geo";

// A scripted convoy so a single person can see the whole experience — members
// spread out, pull ahead, fall behind, and arrive. Purely a frontend showcase;
// it writes through the same data layer as real members.
const CAST = [
  { id: "demo-kofi", name: "Kofi", f: 0.22, speed: 0.055 }, // pulls ahead
  { id: "demo-esi", name: "Esi", f: 0.16, speed: 0.04 }, // travels with the group
  { id: "demo-yaw", name: "Yaw", f: 0.04, speed: 0.022 }, // trails behind
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function startDemoConvoy({
  tripId,
  origin,
  destination,
}: {
  tripId: string;
  origin: LatLng;
  destination: LatLng | null;
}): () => void {
  // If the trip has no destination, head ~5.5km north so movement is meaningful.
  const dest = destination ?? { lat: origin.lat + 0.05, lng: origin.lng };
  const movers = CAST.map((c) => ({ ...c }));

  movers.forEach((m) => data.joinTrip(tripId, m.id, m.name));

  const step = () => {
    for (const m of movers) {
      m.f = Math.min(1, m.f + m.speed * (0.7 + Math.random() * 0.6));
      const jitter = (Math.random() - 0.5) * 0.0006; // ~±30m so pins don't perfectly overlap
      data.updatePosition(tripId, m.id, {
        lat: lerp(origin.lat, dest.lat, m.f) + jitter,
        lng: lerp(origin.lng, dest.lng, m.f) + jitter,
      });
    }
  };

  step();
  const handle = setInterval(step, 2500);
  return () => clearInterval(handle);
}
