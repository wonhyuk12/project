"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { formatPhone } from "@/lib/phone";

type Mode = "login" | "signup";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "signup-sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (mode === "signup" && !name.trim()) {
      setStatus("error");
      setErrorMessage("이름을 입력해주세요.");
      return;
    }
    if (mode === "signup" && phone.replace(/\D/g, "").length < 10) {
      setStatus("error");
      setErrorMessage("전화번호를 010-1234-5678 형식으로 입력해주세요.");
      return;
    }
    setStatus("loading");
    setErrorMessage(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          data: { phone, name: name.trim() },
        },
      });
      if (error) {
        setStatus("error");
        setErrorMessage(
          error.message === "User already registered"
            ? "이미 가입된 이메일이에요 — 로그인해주세요."
            : error.message,
        );
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        // "Confirm email"이 켜져 있으면 이미 가입&인증된 이메일로 다시 가입해도 에러 없이
        // identities가 빈 배열인 가짜 user만 돌아온다(이메일 존재 여부를 숨기기 위한
        // Supabase의 의도된 동작) — 이 신호로 "이미 가입됨"을 판별한다.
        setStatus("error");
        setErrorMessage("이미 가입된 이메일이에요 — 로그인해주세요.");
      } else if (!data.session) {
        // 이메일 인증이 켜져 있으면(기본값) 가입 직후엔 세션이 없다 — 메일함에서
        // 인증 링크를 눌러야 로그인할 수 있다.
        setStatus("signup-sent");
      } else {
        router.push(next);
        router.refresh();
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setStatus("error");
      setErrorMessage(
        error.message === "Email not confirmed"
          ? "이메일 인증이 아직 안 됐어요 — 가입할 때 받은 메일함의 인증 링크를 먼저 눌러주세요."
          : error.message,
      );
    } else {
      router.push(next);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center border-border px-6 py-10 sm:border-x">
      <div className="mb-10 flex items-center gap-2">
        <Logo size={36} />
        <span className="text-lg font-semibold tracking-tight">ChoreoHub</span>
      </div>

      {status === "signup-sent" ? (
        <>
          <h1 className="mb-6 text-xl font-semibold tracking-tight">인증 메일을 보냈어요</h1>
          <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent-light">
            {email}로 인증 링크를 보냈어요. 메일함(스팸함도 확인해주세요)에서 링크를 눌러야
            로그인할 수 있어요.
          </p>
          <button
            onClick={() => {
              setStatus("idle");
              setMode("login");
            }}
            className="mt-4 text-center text-xs text-muted underline"
          >
            로그인 화면으로 돌아가기
          </button>
        </>
      ) : (
        <>
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-accent text-white"
                  : "border border-border bg-surface text-muted hover:bg-surface-hover"
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-accent text-white"
                  : "border border-border bg-surface text-muted hover:bg-surface-hover"
              }`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소"
              className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (6자 이상)"
              className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
            />
            {mode === "signup" && (
              <>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름"
                  className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
                />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="전화번호 (010-1234-5678)"
                  className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
                />
              </>
            )}
            <button
              type="submit"
              disabled={status === "loading"}
              className="mt-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
            >
              {status === "loading"
                ? "처리 중…"
                : mode === "signup"
                  ? "회원가입"
                  : "로그인"}
            </button>
          </form>

          {status === "error" && errorMessage && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
              {errorMessage}
            </p>
          )}

          {mode === "login" && (
            <div className="mt-4 flex justify-center gap-3 text-[11px] text-muted-2">
              <Link href="/login/find-email" className="underline hover:text-muted">
                아이디 찾기
              </Link>
              <span>·</span>
              <Link href="/login/forgot-password" className="underline hover:text-muted">
                비밀번호 찾기
              </Link>
            </div>
          )}

          {mode === "signup" && (
            <p className="mt-6 text-center text-[11px] text-muted-2">
              가입 후 메일 인증을 완료해야 로그인할 수 있어요.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
