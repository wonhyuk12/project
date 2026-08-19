"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/TopBar";
import { Button } from "@/components/ui/Button";
import { usePlanStore } from "@/lib/plan/store";
import { PRO_PRICE_KRW } from "@/lib/plan/constants";

const FREE_FEATURES = ["포즈 감지·추출 (기본 속도)", "일치율 채점(DTW+관절각도)", "프로젝트/버전 무제한 저장"];
const PRO_FEATURES = [
  {
    title: "포즈 추출이 5배 더 빨라요",
    detail:
      "긴 연습 영상도 기다리는 시간을 크게 줄여줘요. 연습 후 바로바로 결과를 보고 싶을 때 유용해요.",
  },
  {
    title: "AI 코치가 구체적으로 짚어줘요",
    detail:
      "숫자 점수만으로는 뭘 고쳐야 할지 알기 어렵죠 — AI가 실제 영상을 보고 \"무엇이 다른지 · 왜 그런지 · 어떻게 고칠지\"를 한국어로 설명해줘요.",
  },
  {
    title: "무료 플랜의 모든 기능 포함",
    detail: "저장·비교·포메이션 뷰 등 기존 기능은 그대로 다 쓸 수 있어요.",
  },
];

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export default function BillingPage() {
  const plan = usePlanStore((s) => s.plan);
  const proExpiresAt = usePlanStore((s) => s.proExpiresAt);
  const downgradeToFree = usePlanStore((s) => s.downgradeToFree);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDowngrade() {
    setLoading(true);
    setErrorMessage(null);
    try {
      await downgradeToFree();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "변경에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="요금제" backHref="/dashboard" />

      <div className="flex flex-col gap-3 px-4 pb-8">
        <p className="rounded-lg bg-accent/10 px-3 py-2 text-center text-xs text-accent-light">
          현재 플랜: {plan === "pro" ? "Pro" : "무료"}
          {plan === "pro" && proExpiresAt && ` · ${formatDate(proExpiresAt)}까지`}
        </p>

        <p className="px-1 text-center text-xs leading-relaxed text-muted">
          무료로도 연습 영상 저장과 정확한 일치율 채점까지 다 할 수 있어요. Pro는{" "}
          <span className="text-foreground">시간</span>(더 빠른 처리)과{" "}
          <span className="text-foreground">디테일</span>(AI가 직접 짚어주는 교정 포인트)을
          더해줘요.
        </p>

        {errorMessage && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            {errorMessage}
          </p>
        )}

        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-medium text-foreground">무료</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">₩0</p>
          <ul className="mt-3 flex flex-col gap-1.5 text-xs text-muted">
            {FREE_FEATURES.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
          {plan === "pro" && (
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={handleDowngrade}
              disabled={loading}
            >
              무료로 변경
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
          <p className="text-sm font-medium text-accent-light">Pro</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            ₩{PRO_PRICE_KRW.toLocaleString()}
            <span className="text-sm font-normal text-muted"> /30일</span>
          </p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {PRO_FEATURES.map((f) => (
              <li key={f.title}>
                <p className="text-xs font-medium text-foreground">· {f.title}</p>
                <p className="mt-0.5 pl-2.5 text-[11px] leading-relaxed text-muted">
                  {f.detail}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg bg-background/60 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
            🎯 이런 분께 추천해요 — 연습 영상이 길거나 자주 올리는 분, 혼자 연습하면서
            사람이 봐주는 것 같은 구체적인 피드백이 필요한 분
          </p>
          {plan === "free" ? (
            <Link
              href="/billing/checkout"
              className="mt-3 flex w-full items-center justify-center rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light"
            >
              Pro로 업그레이드
            </Link>
          ) : (
            <p className="mt-4 text-center text-xs text-accent-light">현재 이용 중인 플랜이에요</p>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-2">
          토스페이먼츠 결제위젯으로 30일 이용권을 결제해요(현재 테스트 모드 — 실제 돈은 안
          나가요). 자동 재결제는 아직 없어서 30일마다 직접 다시 결제해야 해요.
        </p>
      </div>
    </div>
  );
}
