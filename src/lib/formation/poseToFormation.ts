import type { PoseFrame } from "../types";
import type { Dancer } from "./types";

const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;
const VISIBILITY_THRESHOLD = 0.3;
const DEFAULT_STAGE_WIDTH = 8; // formation-studio 기준 STAGE_HALF(4m) * 2
const DEFAULT_STAGE_DEPTH = 8;

interface Options {
  stageWidth?: number;
  stageDepth?: number;
}

/**
 * 발목 랜드마크(27,28)를 바닥 평면에 투영해 사람별 대략적인 무대 좌표를 계산한다.
 * 카메라 각도에 따라 부정확할 수 있는 "러프한 시작값"이며, 사용자가 2D 에디터에서
 * 드래그로 보정하는 걸 전제로 한다. 발목이 둘 다 안 보이면 전체 관절 평균으로 폴백한다.
 */
export function poseFrameToDancers(frame: PoseFrame, opts: Options = {}): Dancer[] {
  const stageWidth = opts.stageWidth ?? DEFAULT_STAGE_WIDTH;
  const stageDepth = opts.stageDepth ?? DEFAULT_STAGE_DEPTH;

  return frame.persons.map((person, index) => {
    const ankles = [person.landmarks[LEFT_ANKLE], person.landmarks[RIGHT_ANKLE]].filter(
      (p): p is NonNullable<typeof p> => !!p && p.visibility >= VISIBILITY_THRESHOLD,
    );
    const source = ankles.length > 0 ? ankles : person.landmarks;

    const avgX = source.reduce((sum, p) => sum + p.x, 0) / source.length;
    const avgY = source.reduce((sum, p) => sum + p.y, 0) / source.length;

    return {
      id: `d-auto-${index}`,
      label: String(index + 1),
      x: (avgX - 0.5) * stageWidth,
      z: (avgY - 0.5) * stageDepth,
    };
  });
}

/** 여러 PoseFrame 중 목표 시각(t)에 가장 가까운 프레임을 찾는다. */
export function findClosestPoseFrame(poseData: PoseFrame[], t: number): PoseFrame | null {
  if (poseData.length === 0) return null;
  return poseData.reduce((closest, frame) =>
    Math.abs(frame.timestamp - t) < Math.abs(closest.timestamp - t) ? frame : closest,
  );
}
