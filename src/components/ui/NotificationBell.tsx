"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/lib/notifications/store";

export function NotificationBell() {
  const router = useRouter();
  const items = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markRead = useNotificationStore((s) => s.markRead);
  const [open, setOpen] = useState(false);

  function handleClick(item: (typeof items)[number]) {
    if (!item.read) markRead(item.id);
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-base leading-none text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        aria-label="알림"
        title="알림"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-20 w-72 max-h-96 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-lg">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-2">알림이 없어요</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-hover ${
                    item.read ? "opacity-60" : ""
                  }`}
                >
                  <span className="flex w-full items-center gap-1.5 text-xs font-medium text-foreground">
                    {!item.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                    {item.title}
                  </span>
                  {item.body && (
                    <span className="text-[11px] leading-relaxed text-muted">{item.body}</span>
                  )}
                  <span className="text-[10px] text-muted-2">{item.createdAt}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
