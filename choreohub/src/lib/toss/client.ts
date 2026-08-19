export interface WidgetAmount {
  currency: "KRW";
  value: number;
}

export interface PaymentWidgets {
  setAmount: (amount: WidgetAmount) => Promise<void>;
  renderPaymentMethods: (params: { selector: string; variantKey?: string }) => Promise<void>;
  renderAgreement: (params: { selector: string; variantKey?: string }) => Promise<void>;
  requestPayment: (params: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerEmail?: string;
    customerName?: string;
  }) => Promise<void>;
}

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      widgets: (params: { customerKey: string }) => PaymentWidgets;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTossScript(): Promise<void> {
  if (window.TossPayments) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v2/standard";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("결제 모듈을 불러오지 못했어요."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** 결제위젯 인스턴스를 만든다. customerKey는 회원 식별용(로그인한 사용자의 id)이다. */
export async function createPaymentWidgets(customerKey: string): Promise<PaymentWidgets> {
  await loadTossScript();
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey || !window.TossPayments) {
    throw new Error("결제 모듈 초기화에 실패했어요.");
  }
  return window.TossPayments(clientKey).widgets({ customerKey });
}
