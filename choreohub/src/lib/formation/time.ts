export function formatMMSS(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * "3:00" 같은 콜론 표기와, 콜론 없이 붙여 쓴 "300"(=3분 00초), "230"(=2분 30초) 표기를
 * 모두 받는다. 콜론이 없을 때는 뒤 두 자리를 초로, 나머지 앞자리를 분으로 해석한다.
 * (두 자리 이하 입력은 그대로 초로 해석 — "45" -> 45초)
 */
export function parseMMSS(input: string): number | null {
  const trimmed = input.trim();

  if (/^\d+$/.test(trimmed)) {
    if (trimmed.length <= 2) {
      return Number(trimmed);
    }
    const s = Number(trimmed.slice(-2));
    const m = Number(trimmed.slice(0, -2));
    if (s >= 60) return null;
    return m * 60 + s;
  }

  const match = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (!match) return null;
  const m = Number(match[1]);
  const s = Number(match[2]);
  if (s >= 60) return null;
  return m * 60 + s;
}
