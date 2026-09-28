import type { PoseFrame } from "./types";

/** Binary search for the PoseFrame whose timestamp is closest to `t`. Assumes poseData is sorted ascending by timestamp. */
export function findNearestFrame(poseData: PoseFrame[], t: number): PoseFrame | null {
  if (poseData.length === 0) return null;
  let lo = 0;
  let hi = poseData.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (poseData[mid].timestamp < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const prev = poseData[lo - 1];
    const curr = poseData[lo];
    if (Math.abs(prev.timestamp - t) <= Math.abs(curr.timestamp - t)) return prev;
  }
  return poseData[lo];
}
