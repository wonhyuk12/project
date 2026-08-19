"use client";

import { useState } from "react";
import { useFormationStore } from "@/lib/formation/store";

interface Props {
  projectId: string;
  sectionId: string;
  rowSpacing: number;
  colSpacing: number;
  onRowSpacingChange: (v: number) => void;
  onColSpacingChange: (v: number) => void;
}

export function GridGeneratorPanel({
  projectId,
  sectionId,
  rowSpacing,
  colSpacing,
  onRowSpacingChange,
  onColSpacingChange,
}: Props) {
  const applyGridFormation = useFormationStore((s) => s.applyGridFormation);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(4);
  const [count, setCount] = useState(12);

  function apply() {
    // 인원 수가 지정된 행×열보다 많으면 행을 자동으로 늘려서 전부 수용한다
    // (인원 수 자체엔 상한이 없음).
    const effectiveRows = Math.max(rows, Math.ceil(count / Math.max(1, cols)));
    applyGridFormation(projectId, sectionId, effectiveRows, cols, count, rowSpacing, colSpacing);
  }

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <p className="mb-2 text-sm font-medium text-foreground">그리드로 만들기</p>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted">
        <label className="flex flex-col gap-1">
          행 (rows)
          <input
            type="number"
            min={1}
            value={rows}
            onChange={(e) => setRows(Math.max(1, Number(e.target.value)))}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          열 (cols)
          <input
            type="number"
            min={1}
            value={cols}
            onChange={(e) => setCols(Math.max(1, Number(e.target.value)))}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          행 간격 · 앞뒤 (m)
          <input
            type="number"
            min={0.3}
            step={0.1}
            value={rowSpacing}
            onChange={(e) => onRowSpacingChange(Math.max(0.3, Number(e.target.value)))}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          열 간격 · 좌우 (m)
          <input
            type="number"
            min={0.3}
            step={0.1}
            value={colSpacing}
            onChange={(e) => onColSpacingChange(Math.max(0.3, Number(e.target.value)))}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground"
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          인원 수
          <input
            type="number"
            min={0}
            value={count}
            onChange={(e) => setCount(Math.max(0, Number(e.target.value)))}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground"
          />
        </label>
      </div>
      <button
        onClick={apply}
        className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light"
      >
        이 대형으로 적용 (기존 배치 대체)
      </button>
      <p className="mt-1.5 text-center text-[11px] text-muted-2">
        인원 수가 행×열보다 많으면 행이 자동으로 늘어나요
      </p>
    </div>
  );
}
