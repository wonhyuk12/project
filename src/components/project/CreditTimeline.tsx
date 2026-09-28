"use client";

import { computeCreditBlocks, creditColorFor } from "@/lib/credit";
import { displayName, type ProfileNameInfo } from "@/lib/profiles";
import type { Version } from "@/lib/types";

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CreditTimeline({
  versions,
  names,
}: {
  versions: Version[];
  names: Map<string, ProfileNameInfo>;
}) {
  const totalDurationSec = Math.max(0, ...versions.map((v) => v.durationSec));
  if (totalDurationSec === 0) return null;

  const blocks = computeCreditBlocks(versions, totalDurationSec);
  const orderedUserIds = [...new Set(blocks.filter((b) => b.userId).map((b) => b.userId!))];

  if (orderedUserIds.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">구간별 크레딧</p>
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-border">
        {blocks.map((b, i) => (
          <div
            key={i}
            title={`${formatSec(b.start)}~${formatSec(b.end)} · ${
              b.userId ? displayName(names.get(b.userId)) : "미지정"
            }`}
            style={{
              width: `${((b.end - b.start) / totalDurationSec) * 100}%`,
              backgroundColor: b.userId ? creditColorFor(b.userId, orderedUserIds) : "#3A444C",
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {orderedUserIds.map((userId) => (
          <div key={userId} className="flex items-center gap-1.5 text-[11px] text-muted-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: creditColorFor(userId, orderedUserIds) }}
            />
            {displayName(names.get(userId))}
          </div>
        ))}
      </div>
    </div>
  );
}
