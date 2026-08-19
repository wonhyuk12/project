"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        "/login/reset-password",
      )}`,
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="비밀번호 찾기" backHref="/login" />
      <div className="flex flex-col gap-4 px-6 py-6">
        {status === "sent" ? (
          <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent-light">
            {email}로 비밀번호 재설정 링크를 보냈어요. 메일함(스팸함도 확인해주세요)에서 링크를
            눌러 새 비밀번호를 설정해주세요.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">
              가입할 때 쓴 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드려요.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소"
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="mt-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
              >
                {status === "loading" ? "보내는 중…" : "재설정 링크 보내기"}
              </button>
            </form>
            {status === "error" && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
                잠시 후 다시 시도해주세요.
              </p>
            )}
          </>
        )}

        <Link href="/login" className="text-center text-xs text-muted underline">
          로그인 화면으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
