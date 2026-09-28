"use client";

import { useRef } from "react";
import { useFormationStore } from "@/lib/formation/store";
import { formatMMSS, parseMMSS } from "@/lib/formation/time";
import type { FormationSection } from "@/lib/formation/types";

type DragMode = "move" | "resize-left" | "resize-right";

interface DragState {
  id: string;
  mode: DragMode;
  startClientX: number;
  origStart: number;
  origEnd: number;
  moved: boolean;
}

const BLOCK_COLORS = [
  "bg-violet-600/70 border-violet-400",
  "bg-violet-800/70 border-violet-500",
  "bg-purple-700/70 border-purple-400",
  "bg-violet-950 border-violet-700",
];

export function FormationTimeline({ projectId }: { projectId: string }) {
  const proj = useFormationStore((s) => s.byProject[projectId]);
  const selectSection = useFormationStore((s) => s.selectSection);
  const updateSectionTiming = useFormationStore((s) => s.updateSectionTiming);
  const setTotalDurationSec = useFormationStore((s) => s.setTotalDurationSec);
  const removeSection = useFormationStore((s) => s.removeSection);
  const renameSection = useFormationStore((s) => s.renameSection);

  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  if (!proj) return null;
  const { sections, totalDurationSec, selectedSectionId } = proj;

  const sorted = [...sections].sort((a, b) => a.startSec - b.startSec);
  const selected = sections.find((s) => s.id === selectedSectionId);

  const interval = totalDurationSec <= 60 ? 10 : totalDurationSec <= 180 ? 15 : 30;
  const ticks: number[] = [];
  for (let t = 0; t <= totalDurationSec; t += interval) ticks.push(t);

  function pxDeltaToSec(deltaPx: number) {
    const width = trackRef.current?.clientWidth ?? 1;
    return (deltaPx / width) * totalDurationSec;
  }

  function beginDrag(e: React.PointerEvent, section: FormationSection, mode: DragMode) {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: section.id,
      mode,
      startClientX: e.clientX,
      origStart: section.startSec,
      origEnd: section.endSec,
      moved: false,
    };
    selectSection(projectId, section.id);
  }

  function onDragMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaPx = e.clientX - drag.startClientX;
    if (Math.abs(deltaPx) > 3) drag.moved = true;
    const deltaSec = Math.round(pxDeltaToSec(deltaPx));
    if (drag.mode === "move") {
      updateSectionTiming(projectId, drag.id, drag.origStart + deltaSec, drag.origEnd + deltaSec);
    } else if (drag.mode === "resize-left") {
      updateSectionTiming(projectId, drag.id, drag.origStart + deltaSec, drag.origEnd);
    } else {
      updateSectionTiming(projectId, drag.id, drag.origStart, drag.origEnd + deltaSec);
    }
  }

  function endDrag(e: React.PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const drag = dragRef.current;
    dragRef.current = null;
    // 드래그 없이 그냥 클릭(선택)했을 때만 이름 입력칸에 바로 포커스 — 드래그 중엔
    // 모바일 키보드가 튀어나오면 안 되니 건드리지 않는다.
    if (drag && drag.mode === "move" && !drag.moved) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }

  function deleteSelected() {
    if (!selected) return;
    if (sections.length <= 1) {
      window.alert("마지막 구간은 삭제할 수 없어요.");
      return;
    }
    if (window.confirm(`"${selected.name}" 구간을 삭제할까요? (배치된 인원도 함께 사라져요)`)) {
      removeSection(projectId, selected.id);
    }
  }

  function commitTimeField(field: "start" | "end", raw: string) {
    if (!selected) return;
    const sec = parseMMSS(raw);
    if (sec === null) return;
    if (field === "start") updateSectionTiming(projectId, selected.id, sec, selected.endSec);
    else updateSectionTiming(projectId, selected.id, selected.startSec, sec);
  }

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>타임라인</span>
        <label className="flex items-center gap-1.5">
          총 길이
          <input
            key={totalDurationSec}
            defaultValue={formatMMSS(totalDurationSec)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            onBlur={(e) => {
              const sec = parseMMSS(e.target.value);
              if (sec !== null) setTotalDurationSec(projectId, sec);
              e.target.value = formatMMSS(
                useFormationStore.getState().byProject[projectId]?.totalDurationSec ?? 0,
              );
            }}
            className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-center text-foreground outline-none focus:border-accent"
          />
        </label>
      </div>

      {/* ruler */}
      <div className="relative mb-1 h-4 text-[10px] text-muted-2">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute -translate-x-1/2"
            style={{ left: `${(t / totalDurationSec) * 100}%` }}
          >
            {formatMMSS(t)}
          </span>
        ))}
      </div>

      {/* track */}
      <div ref={trackRef} className="relative h-12 w-full touch-none rounded-lg bg-background">
        {sorted.map((s, i) => {
          const left = (s.startSec / totalDurationSec) * 100;
          const width = ((s.endSec - s.startSec) / totalDurationSec) * 100;
          const isSelected = s.id === selectedSectionId;
          return (
            <div
              key={s.id}
              className={`absolute top-1 h-10 cursor-grab select-none rounded-md border px-2 text-[11px] leading-10 text-white active:cursor-grabbing ${
                BLOCK_COLORS[i % BLOCK_COLORS.length]
              } ${isSelected ? "ring-2 ring-white/80" : ""}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onPointerDown={(e) => beginDrag(e, s, "move")}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
            >
              <span className="truncate">{s.name}</span>
              <div
                className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
                onPointerDown={(e) => beginDrag(e, s, "resize-left")}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
              />
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
                onPointerDown={(e) => beginDrag(e, s, "resize-right")}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
              />
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
          <label className="flex items-center gap-1.5">
            이름
            <input
              ref={nameInputRef}
              key={`name-${selected.id}`}
              defaultValue={selected.name}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name) renameSection(projectId, selected.id, name);
                else e.target.value = selected.name;
              }}
              className="w-28 rounded border border-border bg-background px-1.5 py-0.5 text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-1.5">
            시작
            <input
              key={`start-${selected.id}-${selected.startSec}`}
              defaultValue={formatMMSS(selected.startSec)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              onBlur={(e) => commitTimeField("start", e.target.value)}
              className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-center text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-1.5">
            끝
            <input
              key={`end-${selected.id}-${selected.endSec}`}
              defaultValue={formatMMSS(selected.endSec)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              onBlur={(e) => commitTimeField("end", e.target.value)}
              className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-center text-foreground outline-none focus:border-accent"
            />
          </label>
          <span className="text-muted-2">
            길이 {Math.max(0, selected.endSec - selected.startSec)}초
          </span>
          <button
            onClick={deleteSelected}
            className="ml-auto rounded border border-red-500/30 px-2 py-0.5 text-red-300 transition-colors hover:bg-red-500/10"
          >
            구간 삭제
          </button>
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-muted-2">
        블록을 (드래그 없이) 클릭하면 이름 칸이 바로 선택돼서 바로 타이핑하면 돼요 ·
        블록 가운데 드래그 = 구간 이동 · 양쪽 끝 드래그 = 길이 조절 · &ldquo;구간
        삭제&rdquo; 버튼으로만 삭제돼요(클릭만으론 안 지워져요)
      </p>
    </div>
  );
}
