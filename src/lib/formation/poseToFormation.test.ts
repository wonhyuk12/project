import { describe, expect, it } from "vitest";
import { poseFrameToDancers, findClosestPoseFrame } from "./poseToFormation";
import type { PoseFrame } from "../types";

function makePersonWithAnkles(x: number, y: number, visibility = 1) {
  // 33 landmarks, only ankles (27, 28) populated meaningfully; rest at 0
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  landmarks[27] = { x, y, z: 0, visibility };
  landmarks[28] = { x, y, z: 0, visibility };
  return landmarks;
}

describe("poseFrameToDancers", () => {
  it("centers a person standing at frame-center to stage origin", () => {
    const frame: PoseFrame = {
      timestamp: 0,
      persons: [{ id: 0, landmarks: makePersonWithAnkles(0.5, 0.5) }],
    };
    const [dancer] = poseFrameToDancers(frame, { stageWidth: 8, stageDepth: 8 });
    expect(dancer.x).toBeCloseTo(0);
    expect(dancer.z).toBeCloseTo(0);
  });

  it("maps a person on the left/back of frame to negative x/z", () => {
    const frame: PoseFrame = {
      timestamp: 0,
      persons: [{ id: 0, landmarks: makePersonWithAnkles(0.25, 0.25) }],
    };
    const [dancer] = poseFrameToDancers(frame, { stageWidth: 8, stageDepth: 8 });
    expect(dancer.x).toBeLessThan(0);
    expect(dancer.z).toBeLessThan(0);
  });

  it("falls back to full-body average when ankles are low-visibility", () => {
    const landmarks = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.8,
    }));
    landmarks[27] = { x: 0.5, y: 0.5, z: 0, visibility: 0.1 }; // low visibility, ignored
    landmarks[28] = { x: 0.5, y: 0.5, z: 0, visibility: 0.1 };
    const frame: PoseFrame = { timestamp: 0, persons: [{ id: 0, landmarks }] };
    const [dancer] = poseFrameToDancers(frame, { stageWidth: 8, stageDepth: 8 });
    expect(dancer.x).toBeCloseTo(0);
    expect(dancer.z).toBeCloseTo(0);
  });

  it("assigns one dancer per detected person, labeled in order", () => {
    const frame: PoseFrame = {
      timestamp: 0,
      persons: [
        { id: 0, landmarks: makePersonWithAnkles(0.3, 0.5) },
        { id: 1, landmarks: makePersonWithAnkles(0.7, 0.5) },
      ],
    };
    const dancers = poseFrameToDancers(frame);
    expect(dancers).toHaveLength(2);
    expect(dancers.map((d) => d.label)).toEqual(["1", "2"]);
  });
});

describe("findClosestPoseFrame", () => {
  const poseData: PoseFrame[] = [0, 1, 2].map((timestamp) => ({ timestamp, persons: [] }));

  it("returns null for empty data", () => {
    expect(findClosestPoseFrame([], 1)).toBeNull();
  });

  it("finds the nearest frame by timestamp", () => {
    expect(findClosestPoseFrame(poseData, 1.4)?.timestamp).toBe(1);
    expect(findClosestPoseFrame(poseData, 1.6)?.timestamp).toBe(2);
  });
});
