import { create } from "zustand";
import { createClient } from "../supabase/client";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

/** 다운로드/사용 요청 같은 "누군가 나한테 뭘 요청했다" 알림 — 헤더 종 아이콘 배지용. */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  hydrated: false,
  loading: false,

  hydrate: async () => {
    if (get().loading) return;
    set({ loading: true });
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error || !data) {
      set({ loading: false, hydrated: true });
      return;
    }
    const items = data.map((row) => ({
      id: row.id as string,
      type: row.type as string,
      title: row.title as string,
      body: (row.body as string | null) ?? null,
      link: (row.link as string | null) ?? null,
      read: row.read as boolean,
      createdAt: (row.created_at as string).slice(0, 10),
    }));
    set({
      items,
      unreadCount: items.filter((i) => !i.read).length,
      loading: false,
      hydrated: true,
    });
  },

  markRead: async (id) => {
    const supabase = createClient();
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (error) return;
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, read: true } : i)),
      unreadCount: Math.max(0, state.unreadCount - (state.items.find((i) => i.id === id)?.read ? 0 : 1)),
    }));
  },
}));
