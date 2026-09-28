import type { Version } from "./types";

export interface CreditBlock {
  start: number;
  end: number;
  userId: string | null; // null = 아직 아무 버전도 안 덮은 구간
}

/**
 * chisung42/choreohub의 creditMap을 참고 — 1초 버킷으로 잘라 "이 구간을 마지막으로 만든 사람"을
 * 계산한다. createdAt 오름차순으로 처리해서 나중 버전이 자기 담당 구간(coversStart~coversEnd)만
 * 덮어쓰고, coversStart가 null인 버전(보통 원작)은 전체를 깔아준다.
 */
export function computeCreditBlocks(versions: Version[], totalDurationSec: number): CreditBlock[] {
  const total = Math.max(1, Math.ceil(totalDurationSec));
  const owner: (string | null)[] = new Array(total).fill(null);

  const chronological = [...versions].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  for (const v of chronological) {
    const from = v.coversStart == null ? 0 : Math.max(0, Math.floor(v.coversStart));
    const to = v.coversEnd == null ? total - 1 : Math.min(total - 1, Math.ceil(v.coversEnd));
    for (let sec = from; sec <= to; sec++) owner[sec] = v.createdBy;
  }

  const blocks: CreditBlock[] = [];
  for (let sec = 0; sec < total; sec++) {
    const last = blocks[blocks.length - 1];
    if (last && last.userId === owner[sec]) {
      last.end = sec + 1;
    } else {
      blocks.push({ start: sec, end: sec + 1, userId: owner[sec] });
    }
  }
  return blocks;
}

export const CREDIT_COLORS = [
  "#7C3AED",
  "#4FC7A2",
  "#E0AE3C",
  "#B490E8",
  "#F0708A",
  "#5AB4E0",
  "#E08C5A",
];

export function creditColorFor(userId: string, orderedUserIds: string[]): string {
  const idx = orderedUserIds.indexOf(userId);
  return CREDIT_COLORS[Math.max(0, idx) % CREDIT_COLORS.length];
}
