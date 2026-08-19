"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setStatus("error");
      setErrorMessage("비밀번호는 6자 이상이어야 해요.");
      return;
    }
    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setErrorMessage(
        error.message === "Auth session missing!"
          ? "재설정 링크가 만료됐어요 — 비밀번호 찾기를 다시 시도해주세요."
          : error.message,
      );
      return;
    }
    setStatus("done");
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="새 비밀번호 설정" />
      <div className="flex flex-col gap-4 px-6 py-6">
        {status === "done" ? (
          <>
            <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent-light">
              비밀번호가 바뀌었어요.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light"
            >
              시작하기
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="새 비밀번호 (6자 이상)"
              className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="mt-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
            >
              {status === "loading" ? "저장하는 중…" : "비밀번호 변경"}
            </button>
            {status === "error" && errorMessage && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
                {errorMessage}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
