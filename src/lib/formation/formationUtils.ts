import type { Dancer, Formation } from "./types";

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `d${idCounter}`;
}

/**
 * rows x cols 그리드로 정확히 배치된 대형을 생성한다.
 * count가 rows*cols보다 적으면 마지막 행만 인원이 모자란 채로 채워진다.
 */
export function makeGridFormation(
  rows: number,
  cols: number,
  count: number,
  rowSpacing = 1.4,
  colSpacing = 1.4,
): Formation {
  const dancers: Dancer[] = [];
  const total = Math.min(count, rows * cols);
  const rowWidth = (cols - 1) * colSpacing;
  const colDepth = (rows - 1) * rowSpacing;

  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = c * colSpacing - rowWidth / 2;
    const z = r * rowSpacing - colDepth / 2;
    dancers.push({ id: nextId(), label: String(i + 1), x, z });
  }
  return { dancers };
}

export function makeFreeformFormation(positions: Array<[number, number]>): Formation {
  return {
    dancers: positions.map(([x, z], i) => ({
      id: nextId(),
      label: String(i + 1),
      x,
      z,
    })),
  };
}

export function makeEmptyDancer(index: number): Dancer {
  return { id: nextId(), label: String(index + 1), x: 0, z: 0 };
}

export function makeDancerAt(index: number, x: number, z: number): Dancer {
  return { id: nextId(), label: String(index + 1), x, z };
}

/** step<=0이면 스냅 없이 소수점 첫째 자리로만 반올림한다. */
export function snapTo(value: number, step: number): number {
  if (step <= 0) return Math.round(value * 10) / 10;
  return Math.round(value / step) * step;
}
