"use client";

import { use, useEffect, useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { useProjectStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

interface MemberRow {
  userId: string;
  email: string | null;
  addedAt: string;
}

export default function ProjectMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setCurrentUserId(user?.id ?? null);

      const { data: memberRows } = await supabase
        .from("project_members")
        .select("user_id, added_at")
        .eq("project_id", projectId);

      const memberIds = (memberRows ?? []).map((m) => m.user_id);
      let emailById = new Map<string, string>();
      if (memberIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", memberIds);
        emailById = new Map((profileRows ?? []).map((p) => [p.id, p.email as string]));
      }

      if (!cancelled) {
        setMembers(
          (memberRows ?? []).map((m) => ({
            userId: m.user_id,
            email: emailById.get(m.user_id) ?? null,
            addedAt: (m.added_at as string).slice(0, 10),
          })),
        );
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleCreateInvite() {
    if (!project) return;
    setCreating(true);
    setErrorMessage(null);
    setCopied(false);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_invites")
        .insert({
          project_id: projectId,
          project_title: project.title,
          created_by: currentUserId,
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("초대 링크 생성에 실패했어요.");

      const url = `${window.location.origin}/invite/${data.id}`;
      setInviteUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        // 클립보드 권한이 없어도 링크는 화면에 보여주니 괜찮다.
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "초대 링크 생성에 실패했어요.");
    } finally {
      setCreating(false);
    }
  }

  if (!project) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="멤버" backHref="/dashboard" />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          프로젝트를 찾을 수 없어요.
        </p>
      </div>
    );
  }

  const isOwner = currentUserId !== null && currentUserId === project.ownerId;

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title={`${project.title} · 멤버`} backHref={`/projects/${projectId}`} />

      <div className="flex flex-col gap-4 px-4 pb-8">
        {loading ? (
          <p className="pt-10 text-center text-sm text-muted">불러오는 중…</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                멤버 {members.length + 1}명
              </p>
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5">
                <span className="text-sm text-foreground">소유자</span>
                <span className="text-xs text-muted-2">본인</span>
              </div>
              {members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5"
                >
                  <span className="truncate text-sm text-foreground">
                    {m.email ?? m.userId}
                  </span>
                  <span className="shrink-0 text-xs text-muted-2">{m.addedAt} 참여</span>
                </div>
              ))}
            </div>

            {isOwner ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleCreateInvite}
                  disabled={creating}
                  className="rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
                >
                  {creating ? "만드는 중…" : "🔗 초대 링크 만들기"}
                </button>
                {inviteUrl && (
                  <div className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-xs">
                    <p className="mb-1 break-all text-accent-light">{inviteUrl}</p>
                    <p className="text-muted-2">
                      {copied ? "클립보드에 복사했어요. " : ""}이 링크를 아는 사람은 누구나 로그인 후
                      멤버로 참여할 수 있어요 · 7일 후 만료
                    </p>
                  </div>
                )}
                {errorMessage && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
                    {errorMessage}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-xs text-muted-2">
                멤버 초대는 프로젝트 소유자만 할 수 있어요.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
