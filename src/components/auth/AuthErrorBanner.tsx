"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Supabase가 만료/무효 토큰인 이메일 링크를 열면 우리 사이트로 ?error=...를 붙여서
 *  돌려보낸다(쿼리와 해시 양쪽에 실릴 수 있음). 예전에 발송된 링크를 나중에 눌러도
 *  빈 화면 대신 안내가 뜨게 잡아준다. */
export function AuthErrorBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await Promise.resolve();
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const errorCode = url.searchParams.get("error_code") ?? hashParams.get("error_code");
      if (!errorCode) return;

      setMessage(
        errorCode === "otp_expired"
          ? "인증 링크가 만료됐어요. 다시 로그인 화면에서 인증번호를 받아주세요."
          : "인증 처리 중 문제가 있었어요. 다시 시도해주세요.",
      );

      url.search = "";
      url.hash = "";
      window.history.replaceState({}, "", url.toString());
    })();
  }, []);

  if (!message) return null;

  return (
    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <p>{message}</p>
      <Link href="/login" className="mt-1 inline-block underline">
        로그인 화면으로 이동
      </Link>
    </div>
  );
}
