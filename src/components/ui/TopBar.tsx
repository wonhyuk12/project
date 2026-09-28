"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useUserStore } from "@/lib/user/store";

interface Props {
  title: ReactNode;
  backHref?: string;
  right?: ReactNode;
  /** "left"는 로고+브랜드명처럼 옆으로 붙여서 왼쪽 정렬할 때 쓴다(기본은 페이지 제목처럼 중앙 정렬). */
  titleAlign?: "center" | "left";
}

export function TopBar({ title, backHref, right, titleAlign = "center" }: Props) {
  const name = useUserStore((s) => s.name);
  const isLeft = titleAlign === "left";
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
        !isLeft && <span className="w-8" />
      )}
      <div className={`flex flex-col gap-0.5 ${isLeft ? "flex-1 items-start" : "items-center"}`}>
        <h1 className="text-base font-medium tracking-tight">{title}</h1>
        {name && <span className="text-[10px] leading-none text-muted-2">{name}님으로 로그인됨</span>}
      </div>
      <div className="flex min-w-8 items-center justify-end gap-1">{right}</div>
    </header>
  );
}
