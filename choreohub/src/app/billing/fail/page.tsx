"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";

function BillingFailInner() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="Pro 업그레이드" backHref="/billing" />
      <div className="flex flex-col items-center gap-3 px-4 pt-16 text-center">
        <p className="text-sm text-muted">카드 등록이 취소됐거나 실패했어요.</p>
        {message && <p className="text-xs text-muted-2">{message}</p>}
        <Link
          href="/billing"
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-light"
        >
          다시 시도하기
        </Link>
      </div>
    </div>
  );
}

export default function BillingFailPage() {
  return (
    <Suspense fallback={null}>
      <BillingFailInner />
    </Suspense>
  );
}
