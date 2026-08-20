"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/store";

type Status =
  | "loading"
  | "ready"
  | "already-member"
  | "self-owner"
  | "joining"
  | "joined"
  | "invalid"
  | "error";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return; // 프록시가 이미 /login으로 보냈을 상황이라 여긴 안전망

      const { data: invite, error } = await supabase
        .from("project_invites")
        .select("project_id, project_title, expires_at")
        .eq("id", token)
        .maybeSingle();

      if (cancelled) return;

      if (error || !invite || new Date(invite.expires_at) < new Date()) {
        setStatus("invalid");
        return;
      }

      setProjectId(invite.project_id);
      setProjectTitle(invite.project_title);

      const { data: projectRow } = await supabase
        .from("projects")
        .select("user_id")
        .eq("id", invite.project_id)
        .maybeSingle();

      if (cancelled) return;

      if (projectRow?.user_id === user.id) {
        setStatus("self-owner");
        return;
      }

      const { data: existing } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("project_id", invite.project_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      setStatus(existing ? "already-member" : "ready");
    }
    load().catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleJoin() {
    if (!projectId) return;
    setStatus("joining");
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요해요.");

      const { error } = await supabase
        .from("project_members")
        .insert({ project_id: projectId, user_id: user.id });
      if (error) throw error;

      await useProjectStore.getState().hydrate();
      setStatus("joined");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "참여에 실패했어요.");
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="프로젝트 초대" backHref="/dashboard" />

      <div className="flex flex-col items-center gap-4 px-4 pt-16 text-center">
        {status === "loading" && <p className="text-sm text-muted">확인하는 중…</p>}

        {status === "invalid" && (
          <p className="text-sm text-muted">
            유효하지 않거나 만료된 초대 링크예요. 프로젝트 소유자에게 새 링크를 요청해주세요.
          </p>
        )}

        {status === "error" && (
          <>
            <p className="text-sm text-red-300">{errorMessage ?? "문제가 발생했어요."}</p>
            <button
              onClick={handleJoin}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-sm text-muted hover:bg-surface-hover"
            >
              다시 시도
            </button>
          </>
        )}

        {status === "self-owner" && projectId && (
          <>
            <p className="text-sm text-muted">
              &quot;{projectTitle}&quot;은 본인이 만든 프로젝트예요 — 이미 모든 권한이 있어서
              따로 참여할 필요가 없어요. 다른 사람에게 이 링크를 공유해주세요.
            </p>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-light"
            >
              프로젝트로 이동
            </button>
          </>
        )}

        {status === "already-member" && projectId && (
          <>
            <p className="text-sm text-muted">
              이미 &quot;{projectTitle}&quot;의 멤버예요.
            </p>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-light"
            >
              프로젝트로 이동
            </button>
          </>
        )}

        {(status === "ready" || status === "joining") && (
          <>
            <p className="text-lg font-medium text-foreground">&quot;{projectTitle}&quot;</p>
            <p className="text-sm text-muted">이 프로젝트의 멤버로 참여하시겠어요?</p>
            <button
              onClick={handleJoin}
              disabled={status === "joining"}
              className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
            >
              {status === "joining" ? "참여하는 중…" : "참여하기"}
            </button>
          </>
        )}

        {status === "joined" && projectId && (
          <>
            <p className="text-sm text-accent-light">참여 완료했어요!</p>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-light"
            >
              프로젝트로 이동
            </button>
          </>
        )}
      </div>
    </div>
  );
}
