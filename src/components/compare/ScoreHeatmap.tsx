import type { FrameScore } from "@/lib/compare/types";

interface Props {
  frameScores: FrameScore[];
  durationSec: number;
  onSeek: (t: number) => void;
}

function colorForScore(score: number): string {
  const hue = Math.max(0, Math.min(120, (score / 100) * 120)); // 0=빨강(낮음) ~ 120=초록(높음)
  return `hsl(${hue}, 70%, 42%)`;
}

export function ScoreHeatmap({ frameScores, durationSec, onSeek }: Props) {
  if (frameScores.length === 0 || durationSec <= 0) return null;

  return (
    <div>
      <div className="flex h-8 w-full overflow-hidden rounded-lg">
        {frameScores.map((f, i) => {
          const next = frameScores[i + 1]?.t ?? durationSec;
          const widthPct = Math.max(0, ((next - f.t) / durationSec) * 100);
          return (
            <button
              key={`${f.t}-${i}`}
              onClick={() => onSeek(f.t)}
              title={`${f.t.toFixed(1)}s · ${f.score}%`}
              style={{ width: `${widthPct}%`, backgroundColor: colorForScore(f.score) }}
              className="h-full shrink-0 transition-[filter] hover:brightness-125"
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-2">
        <span>낮음</span>
        <span>구간을 눌러 그 지점으로 이동</span>
        <span>높음</span>
      </div>
    </div>
  );
}
