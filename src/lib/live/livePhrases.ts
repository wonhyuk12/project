import { JOINT_NAMES } from "../compare/pose-compare";

/** JOINT_NAMES와 같은 순서로 대응하는 짧은 교정 문구. Gemini 없이 즉석에서 보여줄 수 있게
 *  로컬 텍스트로만 구성했다 — 실시간 루프 안에서는 AI 호출을 절대 못 쓴다(15~30초+ 지연). */
const PHRASES: Record<(typeof JOINT_NAMES)[number], string> = {
  "왼쪽 팔꿈치": "왼팔 각도를 맞춰보세요",
  "오른쪽 팔꿈치": "오른팔 각도를 맞춰보세요",
  "왼쪽 어깨": "왼팔 높이를 맞춰보세요",
  "오른쪽 어깨": "오른팔 높이를 맞춰보세요",
  "왼쪽 무릎": "왼쪽 다리 각도를 맞춰보세요",
  "오른쪽 무릎": "오른쪽 다리 각도를 맞춰보세요",
  "왼쪽 고관절": "왼쪽 다리 방향을 맞춰보세요",
  "오른쪽 고관절": "오른쪽 다리 방향을 맞춰보세요",
  "몸통 기울기": "상체 기울기를 맞춰보세요",
  "어깨라인 회전": "몸을 돌리는 각도를 맞춰보세요",
  "골반라인 회전": "골반 방향을 맞춰보세요",
  "머리 기울기": "고개 각도를 맞춰보세요",
};

const PRAISE = ["좋아요!", "잘하고 있어요!", "정확해요!", "그대로 계속!"];

export function phraseForJoint(joint: string): string {
  return PHRASES[joint as (typeof JOINT_NAMES)[number]] ?? "동작을 조금 더 맞춰보세요";
}

export function praisePhrase(seed: number): string {
  return PRAISE[Math.abs(Math.floor(seed)) % PRAISE.length];
}
