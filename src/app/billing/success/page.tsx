"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { usePlanStore } from "@/lib/plan/store";

function BillingSuccessInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "done" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hydratePlan = usePlanStore((s) => s.hydrate);
  // 개발 모드(React Strict Mode)는 effect를 마운트→정리→재마운트로 두 번 실행하는데,
  // ref는 그 사이에도 값이 유지되므로 첫 자동 확인 시도가 두 번 나가는 것만 막아준다.
  // (재시도 버튼으로 다시 부르는 건 이 ref와 무관하게 항상 허용된다.)
  const autoStartedRef = useRef(false);

  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const amountRaw = searchParams.get("amount");

  const confirm = useCallback(async () => {
    setStatus("processing");
    setErrorMessage(null);
    if (!paymentKey || !orderId || !amountRaw) {
      setStatus("error");
      setErrorMessage("결제 정보를 확인하지 못했어요.");
      return;
    }
    try {
      const res = await fetch("/api/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentKey, orderId, amount: Number(amountRaw) }),
        // 서버 쪽에도 타임아웃을 걸어뒀지만, 혹시 그마저도 안 걸리는 경우를 대비해
        // 화면이 "확인하는 중…"에 영원히 멈추지 않게 여기서도 한 번 더 막는다.
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "결제에 실패했어요.");
      await hydratePlan();
      setStatus("done");
    } catch (err) {
      setStatus("error");
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      setErrorMessage(
        timedOut
          ? "20초 넘게 응답이 없었어요. 결제가 됐을 수도 있으니 요금제 화면에서 다시 확인해주세요."
          : err instanceof Error
            ? err.message
            : "결제에 실패했어요.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentKey, orderId, amountRaw]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="Pro 업그레이드" backHref="/billing" />
      <div className="flex flex-col items-center gap-3 px-4 pt-16 text-center">
        {status === "processing" && <p className="text-sm text-muted">결제를 확인하는 중…</p>}
        {status === "done" && (
          <>
            <p className="text-lg font-medium text-accent-light">Pro가 됐어요! 🎉</p>
            <p className="text-xs text-muted">30일 동안 이용할 수 있어요.</p>
            <Link
              href="/billing"
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-light"
            >
              요금제 화면으로
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-sm text-red-300">{errorMessage}</p>
            <div className="flex gap-2">
              <button
                onClick={confirm}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-light"
              >
                다시 확인하기
              </button>
              <Link
                href="/billing"
                className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-muted hover:bg-surface-hover"
              >
                요금제 화면으로
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <BillingSuccessInner />
    </Suspense>
  );
}
