"use client";

import { useFormationStore } from "@/lib/formation/store";
import { snapTo } from "@/lib/formation/formationUtils";
import type { Dancer } from "@/lib/formation/types";

interface Props {
  projectId: string;
  sectionId: string;
  dancers: Dancer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  rowSpacing: number; // z axis (앞뒤)
  colSpacing: number; // x axis (좌우)
  snapEnabled: boolean;
}

export function DancerTable({
  projectId,
  sectionId,
  dancers,
  selectedId,
  onSelect,
  rowSpacing,
  colSpacing,
  snapEnabled,
}: Props) {
  const renameDancer = useFormationStore((s) => s.renameDancer);
  const updateDancerPosition = useFormationStore((s) => s.updateDancerPosition);
  const removeDancer = useFormationStore((s) => s.removeDancer);
  const addDancer = useFormationStore((s) => s.addDancer);
  const setSectionFormation = useFormationStore((s) => s.setSectionFormation);

  function clearAll() {
    if (dancers.length === 0) return;
    if (!window.confirm(`이 구간의 인원 ${dancers.length}명을 전부 삭제할까요?`)) return;
    setSectionFormation(projectId, sectionId, []);
    onSelect(null);
  }

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">직접 배치 (표로 편집)</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-2">{dancers.length}명</span>
          <button
            onClick={clearAll}
            disabled={dancers.length === 0}
            className="text-xs text-muted-2 underline decoration-dotted hover:text-red-400 disabled:pointer-events-none disabled:opacity-40"
          >
            전체 삭제
          </button>
        </div>
      </div>

      <div className="mb-1 flex gap-1.5 px-2 text-[10px] text-muted-2">
        <span className="flex-[1.4]">이름</span>
        <span className="flex-1">X (좌우)</span>
        <span className="flex-1">Z (앞뒤)</span>
        <span className="w-4" />
      </div>

      <div className="flex flex-col gap-1.5">
        {dancers.map((d) => (
          <div
            key={d.id}
            onClick={() => onSelect(d.id)}
            className={`grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs ${
              d.id === selectedId
                ? "border-accent bg-accent/10"
                : "border-border bg-background"
            }`}
          >
            <input
              value={d.label}
              onChange={(e) => renameDancer(projectId, sectionId, d.id, e.target.value)}
              className="min-w-0 rounded bg-transparent px-1 py-1 text-foreground outline-none"
            />
            <input
              type="number"
              step={snapEnabled ? colSpacing : 0.1}
              value={d.x}
              onChange={(e) => {
                const raw = Number(e.target.value);
                const x = snapEnabled ? snapTo(raw, colSpacing) : raw;
                updateDancerPosition(projectId, sectionId, d.id, x, d.z);
              }}
              className="min-w-0 rounded border border-border bg-surface px-1 py-1 text-foreground"
            />
            <input
              type="number"
              step={snapEnabled ? rowSpacing : 0.1}
              value={d.z}
              onChange={(e) => {
                const raw = Number(e.target.value);
                const z = snapEnabled ? snapTo(raw, rowSpacing) : raw;
                updateDancerPosition(projectId, sectionId, d.id, d.x, z);
              }}
              className="min-w-0 rounded border border-border bg-surface px-1 py-1 text-foreground"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeDancer(projectId, sectionId, d.id);
                if (d.id === selectedId) onSelect(null);
              }}
              className="px-1.5 text-muted-2 hover:text-red-400"
              aria-label="삭제"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => addDancer(projectId, sectionId)}
        className="mt-3 w-full rounded-lg border border-dashed border-border py-2 text-sm text-muted"
      >
        + 인원 추가
      </button>
      <p className="mt-1.5 text-center text-[11px] text-muted-2">
        {snapEnabled
          ? `숫자를 입력해도 행 ${rowSpacing}m / 열 ${colSpacing}m 격자에 자동으로 맞춰져요`
          : "격자 스냅이 꺼져 있어서 입력한 숫자가 그대로 들어가요"}
      </p>
    </div>
  );
}
