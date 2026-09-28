import { describe, expect, it } from "vitest";
import {
  angleSetDistance,
  compareLiveFrame,
  compareRangePair,
  compareSequences,
  computeJointAngles,
  dtwAlign,
  mirrorLandmarks,
  normalizeLandmarks,
} from "./pose-compare";
import type { PoseFrame, PoseLandmarkPoint } from "../types";

// ---- test fixture helpers -------------------------------------------------

const NEUTRAL: Record<number, PoseLandmarkPoint> = {
  7: { x: -0.08, y: -0.88, z: 0, visibility: 1 }, // left ear
  8: { x: 0.08, y: -0.88, z: 0, visibility: 1 }, // right ear
  11: { x: -0.2, y: -0.6, z: 0, visibility: 1 }, // left shoulder
  12: { x: 0.2, y: -0.6, z: 0, visibility: 1 }, // right shoulder
  13: { x: -0.25, y: -0.3, z: 0, visibility: 1 }, // left elbow
  14: { x: 0.25, y: -0.3, z: 0, visibility: 1 }, // right elbow
  16: { x: 0.25, y: -0.05, z: 0, visibility: 1 }, // right wrist (fixed)
  23: { x: -0.15, y: 0, z: 0, visibility: 1 }, // left hip
  24: { x: 0.15, y: 0, z: 0, visibility: 1 }, // right hip
  25: { x: -0.17, y: 0.5, z: 0, visibility: 1 }, // left knee
  26: { x: 0.17, y: 0.5, z: 0, visibility: 1 }, // right knee
  27: { x: -0.17, y: 1.0, z: 0, visibility: 1 }, // left ankle
  28: { x: 0.17, y: 1.0, z: 0, visibility: 1 }, // right ankle
};

function rotateVec(v: { x: number; y: number }, deg: number) {
  const r = (deg * Math.PI) / 180;
  return {
    x: v.x * Math.cos(r) - v.y * Math.sin(r),
    y: v.x * Math.sin(r) + v.y * Math.cos(r),
  };
}

/** 왼쪽 팔꿈치 각도만 leftElbowDeg로 바뀌고 나머지 관절은 고정인 33-랜드마크 포즈를 만든다. */
function buildLandmarks(leftElbowDeg: number): PoseLandmarkPoint[] {
  const lm: PoseLandmarkPoint[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 1,
  }));
  for (const [idx, p] of Object.entries(NEUTRAL)) lm[Number(idx)] = { ...p };

  const shoulder = lm[11];
  const elbow = lm[13];
  const upper = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
  const upperLen = Math.hypot(upper.x, upper.y);
  const upperUnit = { x: upper.x / upperLen, y: upper.y / upperLen };
  const forearmDir = rotateVec(upperUnit, leftElbowDeg);
  lm[15] = { x: elbow.x + forearmDir.x * 0.25, y: elbow.y + forearmDir.y * 0.25, z: 0, visibility: 1 };

  return lm;
}

function buildFrame(leftElbowDeg: number, t: number): PoseFrame {
  return { timestamp: t, persons: [{ id: 0, landmarks: buildLandmarks(leftElbowDeg) }] };
}

function mirrorFrame(f: PoseFrame): PoseFrame {
  return {
    timestamp: f.timestamp,
    persons: f.persons.map((p) => ({ id: p.id, landmarks: mirrorLandmarks(p.landmarks) })),
  };
}

// ---- unit tests -------------------------------------------------------

describe("normalizeLandmarks", () => {
  it("places the hip midpoint at the origin", () => {
    const lm = buildLandmarks(120);
    const norm = normalizeLandmarks(lm);
    const hipMidX = (norm[23].x + norm[24].x) / 2;
    const hipMidY = (norm[23].y + norm[24].y) / 2;
    expect(hipMidX).toBeCloseTo(0);
    expect(hipMidY).toBeCloseTo(0);
  });

  it("scales torso length (shoulder mid to hip mid) to 1", () => {
    const lm = buildLandmarks(120);
    const norm = normalizeLandmarks(lm);
    const shMidX = (norm[11].x + norm[12].x) / 2;
    const shMidY = (norm[11].y + norm[12].y) / 2;
    expect(Math.hypot(shMidX, shMidY)).toBeCloseTo(1);
  });
});

describe("computeJointAngles", () => {
  it("reads back a controlled left-elbow angle", () => {
    const norm = normalizeLandmarks(buildLandmarks(90));
    const angles = computeJointAngles(norm);
    expect(angles[0]).not.toBeNull();
    expect(angles[0] as number).toBeCloseTo(90, 0);
  });

  it("returns null for a joint with low-visibility landmarks", () => {
    const lm = buildLandmarks(90);
    lm[15] = { ...lm[15], visibility: 0.1 };
    const angles = computeJointAngles(normalizeLandmarks(lm));
    expect(angles[0]).toBeNull();
  });
});

describe("angleSetDistance", () => {
  it("is 0 for identical angle sets", () => {
    const a = [10, 20, 30];
    expect(angleSetDistance(a, a)).toBe(0);
  });

  it("ignores pairs where either side is null (weight redistribution)", () => {
    expect(angleSetDistance([10, null, 30], [10, 999, 30])).toBe(0);
  });

  it("averages absolute differences over valid pairs", () => {
    expect(angleSetDistance([0, 0], [10, 20])).toBeCloseTo(15);
  });
});

describe("dtwAlign", () => {
  it("aligns identical sequences with zero cost", () => {
    const seq = [[0], [10], [20], [10], [0]];
    const { avgCost } = dtwAlign(seq, seq);
    expect(avgCost).toBeCloseTo(0);
  });

  it("absorbs a stretched (slower) version of the same shape", () => {
    const base = [0, 30, 60, 90, 60, 30, 0].map((v) => [v]);
    // same shape, resampled to ~1.5x the length (linear interpolation)
    const stretched: number[][] = [];
    const factor = 1.5;
    const stretchedLen = Math.round(base.length * factor);
    for (let i = 0; i < stretchedLen; i++) {
      const pos = (i / (stretchedLen - 1)) * (base.length - 1);
      const lo = Math.floor(pos);
      const hi = Math.min(base.length - 1, lo + 1);
      const frac = pos - lo;
      stretched.push([base[lo][0] * (1 - frac) + base[hi][0] * frac]);
    }
    const { avgCost } = dtwAlign(stretched, base);
    expect(avgCost).toBeLessThan(10);
  });
});

describe("compareSequences", () => {
  it("scores identical sequences at 100", () => {
    const frames = Array.from({ length: 10 }, (_, i) =>
      buildFrame(90 + 40 * Math.sin(i / 3), i * 0.2),
    );
    const result = compareSequences(frames, frames);
    expect(result.overallScore).toBe(100);
    expect(result.mirrored).toBe(false);
  });

  it("picks mirror mode for a left-right flipped performer and scores high", () => {
    const refFrames = Array.from({ length: 10 }, (_, i) =>
      buildFrame(90 + 40 * Math.sin(i / 3), i * 0.2),
    );
    const userFrames = refFrames.map(mirrorFrame);
    const result = compareSequences(userFrames, refFrames);
    expect(result.mirrored).toBe(true);
    expect(result.overallScore).toBeGreaterThan(90);
  });

  it("absorbs a 1.5x slower performance via DTW and still scores high", () => {
    const keyframeCount = 10;
    const refFrames = Array.from({ length: keyframeCount }, (_, i) =>
      buildFrame(90 + 60 * Math.sin((i / keyframeCount) * Math.PI), i * 0.2),
    );
    const slowCount = Math.round(keyframeCount * 1.5);
    const userFrames = Array.from({ length: slowCount }, (_, i) => {
      const pos = (i / (slowCount - 1)) * (keyframeCount - 1);
      const angle = 90 + 60 * Math.sin((pos / keyframeCount) * Math.PI);
      return buildFrame(angle, i * 0.2);
    });
    const result = compareSequences(userFrames, refFrames);
    expect(result.overallScore).toBeGreaterThan(85);
  });
});

describe("compareLiveFrame", () => {
  it("scores identical single-frame landmarks at 100", () => {
    const lm = buildLandmarks(90);
    const result = compareLiveFrame(lm, lm, false);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(100);
  });

  it("returns null when either side has no landmarks", () => {
    const lm = buildLandmarks(90);
    expect(compareLiveFrame(null, lm, false)).toBeNull();
    expect(compareLiveFrame(lm, null, false)).toBeNull();
  });

  it("scores a mirrored performer higher when mirror=true than mirror=false", () => {
    const ref = buildLandmarks(120);
    const user = mirrorLandmarks(ref);
    const withoutMirror = compareLiveFrame(user, ref, false);
    const withMirror = compareLiveFrame(user, ref, true);
    expect(withMirror!.score).toBeGreaterThan(withoutMirror!.score);
    expect(withMirror!.score).toBe(100);
  });
});

describe("compareRangePair", () => {
  it("scores a matching offset-cut segment highly", () => {
    // periodic motion (period 2s) so [0,2) and [2,4) contain the same pattern
    const frames = Array.from({ length: 40 }, (_, i) => {
      const t = i * 0.1;
      const angle = 90 + 50 * Math.sin(((t % 2) / 2) * Math.PI * 2);
      return buildFrame(angle, t);
    });
    const result = compareRangePair(
      frames,
      frames,
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      "테스트 구간",
    );
    expect(result.score).toBeGreaterThan(90);
    expect(result.lengthWarning).toBe(false);
  });

  it("flags a length warning when ranges differ by 2x or more", () => {
    const frames = Array.from({ length: 40 }, (_, i) => buildFrame(90, i * 0.1));
    const result = compareRangePair(frames, frames, { start: 0, end: 1 }, { start: 0, end: 3 });
    expect(result.lengthWarning).toBe(true);
  });
});
