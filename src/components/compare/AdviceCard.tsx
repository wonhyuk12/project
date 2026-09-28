"use client";

import { useState } from "react";
import Link from "next/link";
import { useCompareStore } from "@/lib/compare/store";
import { usePlanStore } from "@/lib/plan/store";
import { SceneThumbnail } from "./SceneThumbnail";
import type { AdviceContent, CompareSegment } from "@/lib/compare/types";

interface NumericProps {
  mode: "numeric";
  runId: string;
  userVideoUrl: string;
  refVideoUrl: string;
  segments: CompareSegment[];
  advice?: AdviceContent;
}

interface DescriptiveProps {
  mode: "descriptive";
  runId: string;
  userVideoUrl: string;
  refYoutubeUrl: string;
  refTitle: string;
  advice?: AdviceContent;
}

type AdviceCardProps = NumericProps | DescriptiveProps;

function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

export function AdviceCard(props: AdviceCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAdvice = useCompareStore((s) => s.setAdvice);
  const setDescriptive = useCompareStore((s) => s.setDescriptive);
  const plan = usePlanStore((s) => s.plan);

  async function handleFetch() {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("userVideoUrl", props.userVideoUrl);
      form.append("mode", props.mode);

      if (props.mode === "numeric") {
        const worst3 = [...props.segments].sort((a, b) => a.score - b.score).slice(0, 3);
        form.append("segments", JSON.stringify(worst3));
        form.append("refVideoUrl", props.refVideoUrl);
      } else {
        form.append("segments", "[]");
        form.append("refYoutubeUrl", props.refYoutubeUrl);
        form.append("refTitle", props.refTitle);
      }

      const res = await fetch("/api/compare/advice", { method: "POST", body: form });
      let data: { error?: string } & Partial<AdviceContent>;
      try {
        data = await res.json();
      } catch {
        throw new Error(`서버 오류가 발생했어요 (${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error ?? "AI 조언 생성에 실패했어요.");

      if (props.mode === "numeric") {
        await setAdvice(props.runId, data as AdviceContent);
      } else {
        await setDescriptive(props.runId, { ...(data as AdviceContent), referenceKind: "youtube" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 조언 생성에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }

  if (!props.advice && plan !== "pro") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-accent/30 bg-accent/5 p-4 text-center text-sm">
        <p className="text-muted">✨ Pro로 업그레이드하면 AI 코치 조언을 받을 수 있어요</p>
        <Link
          href="/billing"
          className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-light"
        >
          요금제 보기
        </Link>
      </div>
    );
  }

  if (!props.advice) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface p-4 text-center text-sm">
        {error ? (
          <>
            <p className="text-red-400">{error}</p>
            {props.mode === "numeric" && (
              <p className="text-xs text-muted-2">수치 결과는 그대로 남아있어요.</p>
            )}
          </>
        ) : (
          <p className="text-muted">
            {loading
              ? "AI 코치가 영상을 보고 있어요… (최대 1~2분 걸릴 수 있어요)"
              : "AI 코치에게 구체적인 교정 조언을 받아볼까요?"}
          </p>
        )}
        <button
          onClick={handleFetch}
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
        >
          {loading ? "분석 중…" : error ? "다시 시도" : "✨ AI 조언 받기"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-medium text-foreground">AI 코치 조언</p>
      <p className="text-sm text-muted">{props.advice.overallComment}</p>
      {props.advice.segments.map((seg, i) => (
        <div
          key={`${seg.start}-${i}`}
          className="rounded-xl border border-border/60 bg-background p-3 text-xs"
        >
          <p className="text-accent-light">
            {formatTime(seg.start)} ~ {formatTime(seg.end)}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <SceneThumbnail videoUrl={props.userVideoUrl} time={seg.start} label="내 영상" />
            {props.mode === "numeric" ? (
              <SceneThumbnail videoUrl={props.refVideoUrl} time={seg.start} label="레퍼런스" />
            ) : (
              <a
                href={`${props.refYoutubeUrl}${
                  props.refYoutubeUrl.includes("?") ? "&" : "?"
                }t=${Math.floor(seg.start)}s`}
                target="_blank"
                rel="noreferrer"
                className="flex aspect-video items-center justify-center rounded-lg border border-border/60 bg-surface-hover text-center text-[10px] text-accent-light"
              >
                유튜브에서
                <br />이 시점 보기 ↗
              </a>
            )}
          </div>
          <p className="mt-1.5 text-foreground">
            <span className="text-muted-2">무엇이 다른지 · </span>
            {seg.whatsWrong}
          </p>
          <p className="mt-1 text-muted">
            <span className="text-muted-2">왜 · </span>
            {seg.why}
          </p>
          <p className="mt-1 text-muted">
            <span className="text-muted-2">고치려면 · </span>
            {seg.howToFix}
          </p>
        </div>
      ))}
    </div>
  );
}
