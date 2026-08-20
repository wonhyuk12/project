"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/client";

type Step = "request" | "reset";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setSubmitting(false);
    if (error) {
      setErrorMessage("잠시 후 다시 시도해주세요.");
      return;
    }
    setStep("reset");
  }

  async function handleResend() {
    if (!email.trim()) return;
    setResending(true);
    setResendMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setResending(false);
    setResendMessage(error ? "재전송에 실패했어요 — 잠시 후 다시 시도해주세요." : "인증번호를 다시 보냈어요.");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (otp.trim().length < 6) return;
    if (password.length < 6) {
      setErrorMessage("새 비밀번호는 6자 이상이어야 해요.");
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "recovery",
    });
    if (verifyError) {
      setSubmitting(false);
      setErrorMessage("인증번호가 올바르지 않거나 만료됐어요 — 재전송 후 다시 시도해주세요.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setErrorMessage(updateError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="비밀번호 찾기" backHref="/login" />
      <div className="flex flex-col gap-4 px-6 py-6">
        {step === "request" ? (
          <>
            <p className="text-sm text-muted">
              가입할 때 쓴 이메일 주소를 입력하면 6자리 인증번호를 보내드려요.
            </p>
            <form onSubmit={handleRequest} className="flex flex-col gap-2">
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
                disabled={submitting}
                className="mt-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
              >
                {submitting ? "보내는 중…" : "인증번호 받기"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              {email}로 6자리 인증번호를 보냈어요. 인증번호와 새 비밀번호를 입력해주세요.
            </p>
            <form onSubmit={handleReset} className="flex flex-col gap-2">
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="인증번호 6자리"
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-center text-lg tracking-[0.3em] text-foreground outline-none transition-colors focus:border-accent"
              />
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
                disabled={submitting}
                className="mt-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
              >
                {submitting ? "처리 중…" : "비밀번호 변경"}
              </button>
            </form>
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-center text-xs text-muted underline disabled:opacity-50"
            >
              {resending ? "재전송 중…" : "인증번호 재전송"}
            </button>
            {resendMessage && <p className="text-center text-xs text-muted-2">{resendMessage}</p>}
          </>
        )}

        {errorMessage && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            {errorMessage}
          </p>
        )}

        <Link href="/login" className="text-center text-xs text-muted underline">
          로그인 화면으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
