import { create } from "zustand";
import { createClient } from "../supabase/client";

export type Plan = "free" | "pro";

interface PlanState {
  plan: Plan;
  proExpiresAt: string | null;
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  /** 업그레이드는 /billing/checkout(토스페이먼츠 결제위젯 1회성 결제)이 처리한다 —
   *  결제 없이 plan만 바꾸는 건 해지 방향(downgrade)만 남겨둔다. */
  downgradeToFree: () => Promise<void>;
}

function isExpired(expiresAt: string | null): boolean {
  return !expiresAt || new Date(expiresAt).getTime() <= Date.now();
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plan: "free",
  proExpiresAt: null,
  hydrated: false,
  loading: false,

  hydrate: async () => {
    if (get().loading) return;
    set({ loading: true });
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("plan, pro_expires_at")
      .single();
    if (error || !data) {
      console.error("[planStore] hydrate failed", error);
      set({ loading: false, hydrated: true });
      return;
    }

    // 자동 재결제 스케줄러가 아직 없어서, DB의 plan='pro'가 30일 이용권 만료 후에도 그대로
    // 남아있을 수 있다 — 매번 읽을 때 만료 여부를 직접 확인해서 실제로 유효한 plan만
    // 화면/서버 게이팅에 쓰이게 한다. 만료 발견 시 DB도 같이 되돌려서 다음부터는 이 보정이
    // 필요 없게 한다(self-heal).
    const dbPlan = data.plan as Plan;
    const expiresAt = data.pro_expires_at as string | null;
    const effectivePlan: Plan = dbPlan === "pro" && isExpired(expiresAt) ? "free" : dbPlan;

    if (dbPlan === "pro" && effectivePlan === "free") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ plan: "free" }).eq("id", user.id);
      }
    }

    set({
      plan: effectivePlan,
      proExpiresAt: expiresAt,
      loading: false,
      hydrated: true,
    });
  },

  downgradeToFree: async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요해요.");
    const { error } = await supabase
      .from("profiles")
      .update({ plan: "free" })
      .eq("id", user.id);
    if (error) throw error;
    set({ plan: "free" });
  },
}));
