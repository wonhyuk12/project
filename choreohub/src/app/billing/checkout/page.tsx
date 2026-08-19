"use client";

import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";
import { createPaymentWidgets, type PaymentWidgets } from "@/lib/toss/client";
import { PRO_PRICE_KRW } from "@/lib/plan/constants";

export default function BillingCheckoutPage() {
  const widgetsRef = useRef<PaymentWidgets | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "requesting" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.resolve();
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("로그인이 필요해요.");
        if (cancelled) return;
        setUserEmail(user.email ?? null);

        const widgets = await createPaymentWidgets(user.id);
        if (cancelled) return;
        widgetsRef.current = widgets;

        await widgets.setAmount({ currency: "KRW", value: PRO_PRICE_KRW });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#payment-methods", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
        ]);
        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(err instanceof Error ? err.message : "결제 모듈을 불러오지 못했어요.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePay() {
    const widgets = widgetsRef.current;
    if (!widgets) return;
    setStatus("requesting");
    setErrorMessage(null);
    try {
      const orderId = crypto.randomUUID();
      const origin = window.location.origin;
      await widgets.requestPayment({
        orderId,
        orderName: "ChoreoHub Pro 30일 이용권",
        successUrl: `${origin}/billing/success`,
        failUrl: `${origin}/billing/fail`,
        customerEmail: userEmail ?? undefined,
      });
      // 성공하면 브라우저가 successUrl로 리다이렉트되므로 이 아래는 실행 안 됨.
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "USER_CANCEL") {
        const message = (err as { message?: string })?.message;
        setErrorMessage(message ?? "결제 요청에 실패했어요.");
      }
      setStatus("ready");
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="Pro 결제" backHref="/billing" />

      <div className="flex flex-col gap-4 px-4 pb-8">
        <div className="flex items-center justify-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-center text-sm text-accent-light">
          <Logo size={16} />
          ChoreoHub Pro 30일 이용권 · ₩{PRO_PRICE_KRW.toLocaleString()}
        </div>

        {status === "loading" && <p className="pt-6 text-center text-sm text-muted">결제 모듈을 불러오는 중…</p>}

        {errorMessage && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            {errorMessage}
          </p>
        )}

        <div id="payment-methods" />
        <div id="agreement" />

        {(status === "ready" || status === "requesting") && (
          <button
            onClick={handlePay}
            disabled={status === "requesting"}
            className="rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
          >
            {status === "requesting" ? "처리 중…" : `₩${PRO_PRICE_KRW.toLocaleString()} 결제하기`}
          </button>
        )}
      </div>
    </div>
  );
}
