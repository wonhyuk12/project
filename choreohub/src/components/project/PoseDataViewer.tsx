"use client";

import { useState } from "react";
import type { PoseFrame } from "@/lib/types";

const PREVIEW_LINES = 40;

export function PoseDataViewer({ poseData, fileName }: { poseData: PoseFrame[]; fileName: string }) {
  const [open, setOpen] = useState(false);

  const json = JSON.stringify(poseData, null, 2);
  const lines = json.split("\n");
  const preview = lines.slice(0, PREVIEW_LINES);
  const truncated = lines.length > PREVIEW_LINES;

  function handleDownload() {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-muted hover:text-foreground"
        >
          {open ? "▾" : "▸"} 원본 포즈 데이터 ({poseData.length}프레임)
        </button>
        <button
          onClick={handleDownload}
          className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted transition-colors hover:bg-surface-hover"
        >
          JSON 다운로드
        </button>
      </div>

      {open && (
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-border/60 bg-background p-2">
          <pre className="text-[10px] leading-relaxed text-muted">
            {preview.map((line, i) => (
              <div key={i} className="flex gap-2">
                <span className="w-6 shrink-0 select-none text-right text-muted-2">{i + 1}</span>
                <span className="whitespace-pre">{line}</span>
              </div>
            ))}
          </pre>
          {truncated && (
            <p className="mt-1 text-center text-[10px] text-muted-2">
              앞 {PREVIEW_LINES}줄만 보여줘요 — 전체는 다운로드해서 확인해주세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
