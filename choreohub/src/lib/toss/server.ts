const TOSS_API_BASE = "https://api.tosspayments.com/v1";

function authHeader(): string {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) throw new Error("서버에 TOSS_SECRET_KEY가 설정되지 않았어요.");
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

export interface ConfirmedPayment {
  paymentKey: string;
  orderId: string;
  totalAmount: number;
  method: string;
  approvedAt: string;
}

/** 결제위젯에서 결제 요청 후 successUrl로 돌아온 값을 실제로 승인 확정한다.
 *  이 호출 전까지는 결제가 완료된 게 아니라 "결제 시도"일 뿐이다. */
export async function confirmPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<ConfirmedPayment> {
  let res: Response;
  try {
    res = await fetch(`${TOSS_API_BASE}/payments/confirm`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
      // 토스 쪽이 응답을 안 주면 이 호출이 영원히 멈춰서 우리 API도, 화면도 같이
      // "확인하는 중…"에서 멈춰버린다 — 반드시 타임아웃을 걸어서 에러로 끝나게 한다.
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("결제 승인 요청이 15초 넘게 응답이 없었어요. 잠시 후 다시 시도해주세요.");
    }
    throw new Error("결제 서버에 연결하지 못했어요.");
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? "결제 승인에 실패했어요.");
  }
  return {
    paymentKey: data.paymentKey,
    orderId: data.orderId,
    totalAmount: data.totalAmount,
    method: data.method,
    approvedAt: data.approvedAt,
  };
}
