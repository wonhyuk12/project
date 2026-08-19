import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmPayment } from "@/lib/toss/server";
import { PRO_PRICE_KRW } from "@/lib/plan/constants";

export const runtime = "nodejs";

const PRO_DAYS = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { paymentKey?: string; orderId?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const { paymentKey, orderId, amount } = body;
  if (!paymentKey || !orderId || amount == null) {
    return NextResponse.json({ error: "결제 정보가 올바르지 않아요." }, { status: 400 });
  }
  // 리다이렉트 URL의 amount는 조작될 수 있으니, 우리가 정한 고정 가격과 다르면 승인 자체를
  // 시도하지 않는다(토스도 실제 결제금액과 다르면 어차피 거절하지만, 한 번 더 막아둔다).
  if (amount !== PRO_PRICE_KRW) {
    return NextResponse.json({ error: "결제 금액이 올바르지 않아요." }, { status: 400 });
  }

  try {
    const payment = await confirmPayment({ paymentKey, orderId, amount });

    const expiresAt = new Date(Date.now() + PRO_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ plan: "pro", pro_expires_at: expiresAt })
      .eq("id", user.id);
    if (profileError) {
      // 결제는 이미 승인됐는데 우리 쪽 plan 갱신만 실패한 상황 — 조용히 넘어가면
      // 사용자는 결제했는데 Pro가 안 되는 상태가 된다. 반드시 에러로 알려야 한다.
      throw new Error(`결제는 승인됐지만 계정 갱신에 실패했어요: ${profileError.message}`);
    }

    await supabase.from("billing_charges").insert({
      user_id: user.id,
      amount: payment.totalAmount,
      status: "succeeded",
      toss_payment_key: payment.paymentKey,
      toss_order_id: payment.orderId,
    });

    return NextResponse.json({ ok: true, expiresAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "결제 승인에 실패했어요.";
    await supabase.from("billing_charges").insert({
      user_id: user.id,
      amount: amount ?? PRO_PRICE_KRW,
      status: "failed",
      toss_order_id: orderId,
      failure_reason: message,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
