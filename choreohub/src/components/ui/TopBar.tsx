"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useUserStore } from "@/lib/user/store";

interface Props {
  title: ReactNode;
  backHref?: string;
  right?: ReactNode;
}

export function TopBar({ title, backHref, right }: Props) {
  const name = useUserStore((s) => s.name);
  return (
    <header className="flex items-center justify-between px-4 py-3">
      {backHref ? (
        <Link
          href={backHref}
          className="flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          aria-label="뒤로"
        >
          ‹
        </Link>
      ) : (
        <span className="w-8" />
      )}
      <div className="flex flex-col items-center gap-0.5">
        <h1 className="text-base font-medium tracking-tight">{title}</h1>
        {name && <span className="text-[10px] leading-none text-muted-2">{name}님으로 로그인됨</span>}
      </div>
      <div className="flex min-w-8 items-center justify-end gap-1">{right}</div>
    </header>
  );
}
