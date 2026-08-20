"use client";

import { useState } from "react";
import Link from "next/link";
import { useCompareStore, type StoredRangePair } from "@/lib/compare/store";
import { usePlanStore } from "@/lib/plan/store";

export function RangePairAdvice({
  runId,
  pair,
  userVideoUrl,
  refVideoUrl,
}: {
  runId: string;
  pair: StoredRangePair;
  userVideoUrl: string;
  refVideoUrl: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setRangePairAdvice = useCompareStore((s) => s.setRangePairAdvice);
  const plan = usePlanStore((s) => s.plan);

  async function handleFetch() {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("mode", "numeric");
      form.append("userVideoUrl", userVideoUrl);
      form.append("refVideoUrl", refVideoUrl);
      form.append(
        "segments",
        JSON.stringify([
          {
            label: pair.label ?? "구간쌍",
            start: pair.userRange.start,
            end: pair.userRange.end,
            score: pair.score,
            worstJoints: pair.worstJoints,
          },
        ]),
      );
      form.append("userRange", JSON.stringify(pair.userRange));
      form.append("refRange", JSON.stringify(pair.refRange));

      const res = await fetch("/api/compare/advice", { method: "POST", body: form });
      let data: { error?: string; segments?: { whatsWrong: string; why: string; howToFix: string }[] };
      try {
        data = await res.json();
      } catch {
        throw new Error(`서버 오류가 발생했어요 (${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error ?? "AI 조언 생성에 실패했어요.");

      const first = data.segments?.[0];
      if (!first) throw new Error("AI 응답을 이해하지 못했어요.");
      await setRangePairAdvice(runId, pair.id, {
        whatsWrong: first.whatsWrong,
        why: first.why,
        howToFix: first.howToFix,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 조언 생성에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }

  if (pair.advice) {
    return (
      <div className="mt-2 rounded-lg border border-border/60 bg-background p-2.5 text-[11px]">
        <p className="text-foreground">
          <span className="text-muted-2">무엇이 다른지 · </span>
          {pair.advice.whatsWrong}
        </p>
        <p className="mt-1 text-muted">
          <span className="text-muted-2">왜 · </span>
          {pair.advice.why}
        </p>
        <p className="mt-1 text-muted">
          <span className="text-muted-2">고치려면 · </span>
          {pair.advice.howToFix}
        </p>
      </div>
    );
  }

  if (plan !== "pro") {
    return (
      <div className="mt-2">
        <Link href="/billing" className="text-[11px] text-accent-light underline">
          ✨ Pro로 업그레이드하면 AI 조언을 받을 수 있어요
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        onClick={handleFetch}
        disabled={loading}
        className="rounded-lg border border-accent/40 px-2.5 py-1 text-[11px] text-accent-light transition-colors hover:bg-accent/10 disabled:opacity-50"
      >
        {loading ? "분석 중…" : "✨ AI 조언"}
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
