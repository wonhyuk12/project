import type { PoseFrame, PosePersonFrame } from "./types";

function lerp(a: number, b: number, ratio: number): number {
  return a + (b - a) * ratio;
}

/**
 * Returns the pose at time `t`, linearly interpolated between the two sampled
 * frames that bracket it. The raw pose data is only sampled at ~5fps, so without
 * this the overlay visibly snaps/steps between poses every ~200ms during playback.
 */
export function interpolatePoseAt(poseData: PoseFrame[], t: number): PosePersonFrame[] {
  if (poseData.length === 0) return [];
  if (poseData.length === 1 || t <= poseData[0].timestamp) return poseData[0].persons;
  const last = poseData[poseData.length - 1];
  if (t >= last.timestamp) return last.persons;

  let lo = 0;
  let hi = poseData.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (poseData[mid].timestamp <= t) lo = mid;
    else hi = mid;
  }
  const a = poseData[lo];
  const b = poseData[hi];
  const span = b.timestamp - a.timestamp;
  const ratio = span > 0 ? (t - a.timestamp) / span : 0;

  const count = Math.min(a.persons.length, b.persons.length);
  const persons: PosePersonFrame[] = [];
  for (let i = 0; i < count; i++) {
    const pa = a.persons[i];
    const pb = b.persons[i];
    const landmarks = pa.landmarks.map((la, idx) => {
      const lb = pb.landmarks[idx];
      if (!lb) return la;
      return {
        x: lerp(la.x, lb.x, ratio),
        y: lerp(la.y, lb.y, ratio),
        z: lerp(la.z, lb.z, ratio),
        visibility: lerp(la.visibility, lb.visibility, ratio),
      };
    });
    persons.push({ id: pa.id, landmarks });
  }
  return persons;
}
