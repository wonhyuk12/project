"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useUserStore } from "@/lib/user/store";

const NAV_LINKS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/billing", label: "요금제" },
];

// 로그인 전 화면(랜딩/로그인류)에는 대시보드·로그아웃이 의미가 없어서 안 보여준다.
const HIDDEN_ON = ["/", "/login"];

/** 넓은 화면(PC)에서만 보이는 사이트 전체 상단 내비게이션 — 모바일에서는 각 페이지의
 *  TopBar가 그대로 역할을 한다. "앱처럼 보인다"는 피드백에 대응해 데스크톱에서 일반
 *  웹사이트처럼 로고·메뉴·로그아웃이 항상 보이는 고정 헤더를 둔다. */
export function SiteHeader() {
  const pathname = usePathname();
  const name = useUserStore((s) => s.name);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <header className="sticky top-0 z-10 hidden border-b border-border bg-surface/70 backdrop-blur md:flex md:items-center md:justify-between md:px-8 md:py-3">
      <Link href="/dashboard" className="flex items-center gap-2">
        <Logo size={28} />
        <span className="text-lg font-semibold tracking-tight">ChoreoHub</span>
      </Link>

      <nav className="flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname === link.href
                ? "bg-accent/15 text-accent-light"
                : "text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {name && <span className="text-sm text-muted">{name}님</span>}
        <LogoutButton />
      </div>
    </header>
  );
}
