import { describe, expect, it } from "vitest";
import { findNearestFrame } from "./findNearestFrame";
import type { PoseFrame } from "./types";

const frames: PoseFrame[] = [0, 0.2, 0.4, 0.6, 0.8].map((timestamp) => ({
  timestamp,
  persons: [],
}));

describe("findNearestFrame", () => {
  it("returns null for empty data", () => {
    expect(findNearestFrame([], 1)).toBeNull();
  });

  it("finds an exact match", () => {
    expect(findNearestFrame(frames, 0.4)?.timestamp).toBe(0.4);
  });

  it("rounds to the nearer neighbor", () => {
    expect(findNearestFrame(frames, 0.29)?.timestamp).toBe(0.2);
    expect(findNearestFrame(frames, 0.31)?.timestamp).toBe(0.4);
  });

  it("clamps before the first and after the last frame", () => {
    expect(findNearestFrame(frames, -1)?.timestamp).toBe(0);
    expect(findNearestFrame(frames, 10)?.timestamp).toBe(0.8);
  });
});
