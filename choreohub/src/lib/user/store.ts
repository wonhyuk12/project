import { create } from "zustand";
import { createClient } from "../supabase/client";

interface UserState {
  name: string | null;
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
}

/** 로그인한 사용자의 이름을 화면(TopBar)에 계속 보여주기 위한 상태.
 *  "이 계정으로 로그인했다"를 페이지마다 인지할 수 있게 하는 용도라 값 하나만 관리한다. */
export const useUserStore = create<UserState>((set, get) => ({
  name: null,
  hydrated: false,
  loading: false,

  hydrate: async () => {
    if (get().loading) return;
    set({ loading: true });
    const supabase = createClient();
    const { data, error } = await supabase.from("profiles").select("name").single();
    if (error || !data) {
      set({ loading: false, hydrated: true });
      return;
    }
    set({ name: (data.name as string | null) ?? null, loading: false, hydrated: true });
  },
}));
