import { describe, expect, it } from "vitest";
import { interpolatePoseAt } from "./interpolatePose";
import type { PoseFrame } from "./types";

const lm = (x: number) => ({ x, y: 0, z: 0, visibility: 1 });

const poseData: PoseFrame[] = [
  { timestamp: 0, persons: [{ id: 0, landmarks: [lm(0)] }] },
  { timestamp: 0.2, persons: [{ id: 0, landmarks: [lm(1)] }] },
];

describe("interpolatePoseAt", () => {
  it("returns empty for no data", () => {
    expect(interpolatePoseAt([], 0.1)).toEqual([]);
  });

  it("clamps to the first frame before the range", () => {
    expect(interpolatePoseAt(poseData, -1)[0].landmarks[0].x).toBe(0);
  });

  it("clamps to the last frame after the range", () => {
    expect(interpolatePoseAt(poseData, 5)[0].landmarks[0].x).toBe(1);
  });

  it("interpolates linearly at the midpoint", () => {
    expect(interpolatePoseAt(poseData, 0.1)[0].landmarks[0].x).toBeCloseTo(0.5);
  });

  it("interpolates at a quarter point", () => {
    expect(interpolatePoseAt(poseData, 0.05)[0].landmarks[0].x).toBeCloseTo(0.25);
  });
});
