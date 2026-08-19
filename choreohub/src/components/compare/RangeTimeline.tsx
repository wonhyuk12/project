"use client";

import { useRef } from "react";
import { formatMMSS, parseMMSS } from "@/lib/formation/time";
import type { TimeRange } from "@/lib/compare/types";

type DragMode = "move" | "resize-left" | "resize-right";

interface DragState {
  mode: DragMode;
  startClientX: number;
  origStart: number;
  origEnd: number;
}

interface Props {
  label: string;
  durationSec: number;
  range: TimeRange;
  onChange: (range: TimeRange) => void;
  colorClass?: string;
}

export function RangeTimeline({
  label,
  durationSec,
  range,
  onChange,
  colorClass = "bg-accent/70 border-accent",
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  function pxDeltaToSec(deltaPx: number) {
    const width = trackRef.current?.clientWidth ?? 1;
    return (deltaPx / width) * durationSec;
  }

  function beginDrag(e: React.PointerEvent, mode: DragMode) {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startClientX: e.clientX, origStart: range.start, origEnd: range.end };
  }

  function onDragMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaSec = pxDeltaToSec(e.clientX - drag.startClientX);
    const minLen = Math.max(0.2, durationSec * 0.01);

    if (drag.mode === "move") {
      const len = drag.origEnd - drag.origStart;
      const start = Math.max(0, Math.min(durationSec - len, drag.origStart + deltaSec));
      onChange({ start, end: start + len });
    } else if (drag.mode === "resize-left") {
      const start = Math.max(0, Math.min(drag.origEnd - minLen, drag.origStart + deltaSec));
      onChange({ start, end: drag.origEnd });
    } else {
      const end = Math.min(durationSec, Math.max(drag.origStart + minLen, drag.origEnd + deltaSec));
      onChange({ start: drag.origStart, end });
    }
  }

  function endDrag(e: React.PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }

  function commitField(field: "start" | "end", raw: string) {
    const sec = parseMMSS(raw);
    if (sec === null) return;
    if (field === "start") onChange({ start: Math.max(0, Math.min(sec, range.end)), end: range.end });
    else onChange({ start: range.start, end: Math.min(durationSec, Math.max(sec, range.start)) });
  }

  const leftPct = durationSec > 0 ? (range.start / durationSec) * 100 : 0;
  const widthPct = durationSec > 0 ? ((range.end - range.start) / durationSec) * 100 : 0;

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <p className="mb-1.5 text-xs text-muted">{label}</p>
      <div ref={trackRef} className="relative h-10 w-full touch-none rounded-lg bg-background">
        <div
          className={`absolute top-1 h-8 cursor-grab select-none rounded-md border active:cursor-grabbing ${colorClass}`}
          style={{ left: `${leftPct}%`, width: `${Math.max(1, widthPct)}%` }}
          onPointerDown={(e) => beginDrag(e, "move")}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
        >
          <div
            className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
            onPointerDown={(e) => beginDrag(e, "resize-left")}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
          />
          <div
            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
            onPointerDown={(e) => beginDrag(e, "resize-right")}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
          />
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
        <label className="flex items-center gap-1.5">
          시작
          <input
            key={`s-${range.start.toFixed(1)}`}
            defaultValue={formatMMSS(range.start)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            onBlur={(e) => commitField("start", e.target.value)}
            className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-center text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="flex items-center gap-1.5">
          끝
          <input
            key={`e-${range.end.toFixed(1)}`}
            defaultValue={formatMMSS(range.end)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            onBlur={(e) => commitField("end", e.target.value)}
            className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-center text-foreground outline-none focus:border-accent"
          />
        </label>
        <span className="text-muted-2">길이 {Math.max(0, range.end - range.start).toFixed(1)}초</span>
      </div>
    </div>
  );
}
