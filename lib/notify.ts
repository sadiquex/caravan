import type { StatusKey } from "./types";

type StatusMap = Record<string, StatusKey>;

const MESSAGE: Partial<Record<StatusKey, (name: string) => string>> = {
  arrived: (n) => `${n} has arrived`,
  behind: (n) => `${n} is now behind the group`,
  ahead: (n) => `${n} pulled ahead`,
  stopped: (n) => `${n} has stopped`,
  with: (n) => `${n} is back with the group`,
};

// Compares two status snapshots and returns human messages for meaningful changes.
// Only members present in `prev` are considered, so freshly joined members don't spam.
export function diffStatuses(
  prev: StatusMap,
  next: StatusMap,
  names: Record<string, string>
): string[] {
  const ids = Object.keys(next);

  const everyoneArrived = ids.length >= 2 && ids.every((id) => next[id] === "arrived");
  const wasEveryoneArrived = ids.length >= 2 && ids.every((id) => prev[id] === "arrived");
  if (everyoneArrived && !wasEveryoneArrived) return ["Everyone has arrived"];

  const messages: string[] = [];
  for (const id of ids) {
    if (!(id in prev) || prev[id] === next[id]) continue;
    const build = MESSAGE[next[id]];
    if (build) messages.push(build(names[id] ?? "Someone"));
  }
  return messages;
}
