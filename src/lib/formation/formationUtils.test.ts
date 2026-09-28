import { describe, expect, it } from "vitest";
import { makeGridFormation, makeFreeformFormation } from "./formationUtils";

describe("makeGridFormation", () => {
  it("places dancers on an exact rows x cols grid", () => {
    const { dancers } = makeGridFormation(3, 4, 12, 1, 1);
    expect(dancers).toHaveLength(12);
    // 4 unique x values (columns), 3 unique z values (rows)
    expect(new Set(dancers.map((d) => d.x)).size).toBe(4);
    expect(new Set(dancers.map((d) => d.z)).size).toBe(3);
  });

  it("fills only as many as count when count < rows*cols", () => {
    const { dancers } = makeGridFormation(3, 4, 5);
    expect(dancers).toHaveLength(5);
  });

  it("is centered on the origin", () => {
    const { dancers } = makeGridFormation(1, 3, 3, 1, 1);
    const xs = dancers.map((d) => d.x).sort((a, b) => a - b);
    expect(xs[1]).toBeCloseTo(0);
  });
});

describe("makeFreeformFormation", () => {
  it("maps positions 1:1 to dancers with sequential labels", () => {
    const { dancers } = makeFreeformFormation([
      [1, 2],
      [3, 4],
    ]);
    expect(dancers.map((d) => [d.x, d.z])).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(dancers.map((d) => d.label)).toEqual(["1", "2"]);
  });
});
