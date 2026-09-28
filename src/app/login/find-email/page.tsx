"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/phone";

export default function FindEmailPage() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "not-found" | "error">(
    "idle",
  );
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 10) return;
    setStatus("loading");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("find_masked_email_by_phone", {
      p_phone: phone,
    });
    if (error) {
      setStatus("error");
      return;
    }
    if (data) {
      setMaskedEmail(data as string);
      setStatus("found");
    } else {
      setStatus("not-found");
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="아이디 찾기" backHref="/login" />
      <div className="flex flex-col gap-4 px-6 py-6">
        <p className="text-sm text-muted">
          가입할 때 입력한 전화번호를 입력하면 이메일(아이디)을 일부만 가려서 알려드려요.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="전화번호 (010-1234-5678)"
            className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
          >
            {status === "loading" ? "찾는 중…" : "아이디 찾기"}
          </button>
        </form>

        {status === "found" && maskedEmail && (
          <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-center text-sm text-accent-light">
            {maskedEmail}
          </p>
        )}
        {status === "not-found" && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            일치하는 계정을 찾지 못했어요.
          </p>
        )}
        {status === "error" && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            잠시 후 다시 시도해주세요.
          </p>
        )}

        <Link href="/login" className="text-center text-xs text-muted underline">
          로그인 화면으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
