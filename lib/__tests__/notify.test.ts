import { describe, it, expect } from "vitest";
import { diffStatuses } from "../notify";
import type { StatusKey } from "../types";

const names = { a: "Ama", k: "Kojo", s: "Sarah" };
type S = Record<string, StatusKey>;

describe("diffStatuses", () => {
  it("returns nothing when nothing changed", () => {
    const prev: S = { a: "with", k: "behind" };
    expect(diffStatuses(prev, { ...prev }, names)).toEqual([]);
  });

  it("announces an arrival", () => {
    expect(diffStatuses({ k: "behind" }, { k: "arrived" }, names)).toEqual(["Kojo has arrived"]);
  });

  it("announces falling behind", () => {
    expect(diffStatuses({ a: "with" }, { a: "behind" }, names)).toEqual(["Ama is now behind the group"]);
  });

  it("announces stopping and rejoining", () => {
    expect(diffStatuses({ a: "with" }, { a: "stopped" }, names)).toEqual(["Ama has stopped"]);
    expect(diffStatuses({ a: "behind" }, { a: "with" }, names)).toEqual(["Ama is back with the group"]);
  });

  it("ignores brand-new members (not present before)", () => {
    expect(diffStatuses({}, { a: "with" }, names)).toEqual([]);
  });

  it("collapses to a single message when everyone has arrived", () => {
    const prev: S = { a: "arrived", k: "behind", s: "arrived" };
    const next: S = { a: "arrived", k: "arrived", s: "arrived" };
    expect(diffStatuses(prev, next, names)).toEqual(["Everyone has arrived"]);
  });
});
