"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { formatPhone } from "@/lib/phone";

type Mode = "login" | "signup";
type Step = "quick" | "form" | "verify-otp";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [checkingSession, setCheckingSession] = useState(true);

  // 익명 로그인은 "이름으로 시작하기"를 다시 누를 때마다 완전히 새 계정을 만든다 — 이미
  // 로그인된 사람이 실수로(뒤로가기, 북마크 등) /login에 다시 들어와서 또 누르면 조용히
  // 다른 계정으로 갈아타서 자기 프로젝트 소유권을 잃어버린다. 그래서 세션이 이미 있으면
  // 폼을 보여주지 않고 바로 넘긴다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        router.replace(next);
        return;
      }
      setCheckingSession(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("quick");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [quickName, setQuickName] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // 해커톤용 — 이메일/비밀번호/인증번호 없이 이름만으로 바로 들어온다. Supabase 익명 로그인으로
  // 실제 auth.uid()가 있는 세션을 만들고, 이름은 raw_user_meta_data로 넘겨서 기존
  // handle_new_user() 트리거가 profiles.name에 그대로 채워 넣게 한다(스키마 변경 불필요).
  async function handleQuickStart(e: React.FormEvent) {
    e.preventDefault();
    if (!quickName.trim()) return;
    setSubmitting(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { name: quickName.trim() } },
    });
    setSubmitting(false);
    if (error) {
      setErrorMessage(
        error.message.includes("Anonymous sign-ins are disabled")
          ? "관리자가 익명 로그인을 아직 켜지 않았어요 — 이메일로 로그인해주세요."
          : error.message,
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (mode === "signup" && !name.trim()) {
      setErrorMessage("이름을 입력해주세요.");
      return;
    }
    if (mode === "signup" && phone.replace(/\D/g, "").length < 10) {
      setErrorMessage("전화번호를 010-1234-5678 형식으로 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { phone, name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setSubmitting(false);
      if (error) {
        setErrorMessage(
          error.message === "User already registered"
            ? "이미 가입된 이메일이에요 — 로그인해주세요."
            : error.message,
        );
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        // "Confirm email"이 켜져 있으면 이미 가입&인증된 이메일로 다시 가입해도 에러 없이
        // identities가 빈 배열인 가짜 user만 돌아온다(이메일 존재 여부를 숨기기 위한
        // Supabase의 의도된 동작) — 이 신호로 "이미 가입됨"을 판별한다.
        setErrorMessage("이미 가입된 이메일이에요 — 로그인해주세요.");
      } else if (!data.session) {
        // 이메일 인증이 켜져 있으면(기본값) 가입 직후엔 세션이 없다 — 메일로 받은 6자리
        // 인증번호를 입력해야 로그인할 수 있다(링크 클릭 방식은 메일 서비스의 자동
        // 미리보기가 토큰을 먼저 소비해버리는 문제가 있어 코드 입력 방식을 쓴다).
        setStep("verify-otp");
      } else {
        router.push(next);
        router.refresh();
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      if (error.message === "Email not confirmed") {
        setErrorMessage("이메일 인증이 아직 안 됐어요. 인증번호를 입력해서 완료해주세요.");
        setStep("verify-otp");
      } else {
        setErrorMessage(error.message);
      }
    } else {
      router.push(next);
      router.refresh();
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.trim().length < 6) return;
    setSubmitting(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "signup",
    });
    setSubmitting(false);
    if (error) {
      setErrorMessage("인증번호가 올바르지 않거나 만료됐어요 — 재전송 후 다시 시도해주세요.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function handleResendOtp() {
    if (!email.trim()) return;
    setResending(true);
    setResendMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResending(false);
    setResendMessage(error ? "재전송에 실패했어요 — 잠시 후 다시 시도해주세요." : "인증번호를 다시 보냈어요.");
  }

  if (checkingSession) return null;

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center border-border px-6 py-10 sm:border-x">
      <div className="mb-10 flex items-center gap-2">
        <Logo size={36} />
        <span className="text-lg font-semibold tracking-tight">ChoreoHub</span>
      </div>

      {step === "quick" ? (
        <>
          <h1 className="mb-2 text-xl font-semibold tracking-tight">이름만 입력하고 시작해요</h1>
          <p className="mb-6 text-sm text-muted">
            이메일이나 비밀번호 없이 이름만으로 바로 시작할 수 있어요.
          </p>

          <form onSubmit={handleQuickStart} className="flex flex-col gap-2">
            <input
              type="text"
              required
              autoFocus
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="이름 (예: 김안무)"
              className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
            />
            <button
              type="submit"
              disabled={submitting || !quickName.trim()}
              className="mt-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
            >
              {submitting ? "시작하는 중…" : "시작하기"}
            </button>
          </form>

          {errorMessage && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
              {errorMessage}
            </p>
          )}

          <button
            onClick={() => {
              setStep("form");
              setErrorMessage(null);
            }}
            className="mt-6 text-center text-xs text-muted underline"
          >
            이메일로 로그인/회원가입
          </button>
        </>
      ) : step === "verify-otp" ? (
        <>
          <h1 className="mb-2 text-xl font-semibold tracking-tight">인증번호를 입력해주세요</h1>
          <p className="mb-6 text-sm text-muted">
            {email}로 6자리 인증번호를 보냈어요. 메일함(스팸함도 확인해주세요)에서 확인해서
            입력해주세요.
          </p>

          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-2">
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
            <button
              type="submit"
              disabled={submitting || otp.length < 6}
              className="mt-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
            >
              {submitting ? "확인 중…" : "인증하기"}
            </button>
          </form>

          {errorMessage && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
              {errorMessage}
            </p>
          )}

          <button
            onClick={handleResendOtp}
            disabled={resending}
            className="mt-4 text-center text-xs text-muted underline disabled:opacity-50"
          >
            {resending ? "재전송 중…" : "인증번호 재전송"}
          </button>
          {resendMessage && <p className="mt-1 text-center text-xs text-muted-2">{resendMessage}</p>}

          <button
            onClick={() => {
              setStep("form");
              setOtp("");
              setErrorMessage(null);
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
              disabled={submitting}
              className="mt-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
            >
              {submitting ? "처리 중…" : mode === "signup" ? "회원가입" : "로그인"}
            </button>
          </form>

          {errorMessage && (
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
              가입 후 메일로 받는 인증번호를 입력해야 로그인할 수 있어요.
            </p>
          )}

          <button
            onClick={() => {
              setStep("quick");
              setErrorMessage(null);
            }}
            className="mt-4 text-center text-xs text-muted underline"
          >
            ‹ 이름으로 빠르게 시작하기
          </button>
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
