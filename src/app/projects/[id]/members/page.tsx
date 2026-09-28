"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { useProjectStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import type { CollabPermission } from "@/lib/types";

const PERMISSIONS: CollabPermission[] = ["보기만", "수정 제안", "직접 수정"];
const PERMISSION_HINT: Record<CollabPermission, string> = {
  보기만: "영상·비교 기록을 볼 수만 있어요",
  "수정 제안": "볼 수 있지만 새 버전·비교는 못 올려요 (제안은 댓글 등으로)",
  "직접 수정": "소유자와 동일하게 버전 추가·비교 분석을 할 수 있어요",
};

interface MemberRow {
  userId: string;
  email: string | null;
  name: string | null;
  permission: CollabPermission;
  role: string;
  counts: string;
  addedAt: string;
}

export default function ProjectMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ permission: CollabPermission; role: string; counts: string }>({
    permission: "수정 제안",
    role: "",
    counts: "",
  });
  const [saving, setSaving] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

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
        .select("user_id, added_at, permission, role, counts")
        .eq("project_id", projectId);

      const memberIds = (memberRows ?? []).map((m) => m.user_id);
      let profileById = new Map<string, { email: string | null; name: string | null }>();
      if (memberIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, email, name")
          .in("id", memberIds);
        profileById = new Map(
          (profileRows ?? []).map((p) => [p.id, { email: p.email as string | null, name: p.name as string | null }]),
        );
      }

      if (cancelled) return;
      setMembers(
        (memberRows ?? []).map((m) => ({
          userId: m.user_id,
          email: profileById.get(m.user_id)?.email ?? null,
          name: profileById.get(m.user_id)?.name ?? null,
          permission: m.permission as CollabPermission,
          role: m.role as string,
          counts: m.counts as string,
          addedAt: (m.added_at as string).slice(0, 10),
        })),
      );
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

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

  function openEdit(m: MemberRow) {
    setEditingUserId(m.userId);
    setDraft({ permission: m.permission, role: m.role, counts: m.counts });
    setErrorMessage(null);
  }

  async function saveEdit() {
    if (!editingUserId) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("project_members")
        .update({ permission: draft.permission, role: draft.role.trim(), counts: draft.counts.trim() })
        .eq("project_id", projectId)
        .eq("user_id", editingUserId);
      if (error) throw error;
      setEditingUserId(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId: string) {
    if (!window.confirm("이 멤버를 프로젝트에서 내보낼까요?")) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId);
      if (error) throw error;
      setEditingUserId(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "내보내기에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function leaveProject() {
    if (!currentUserId) return;
    if (!window.confirm("이 프로젝트에서 나갈까요?")) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", currentUserId);
      if (error) throw error;
      router.push("/dashboard");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "나가기에 실패했어요.");
      setSaving(false);
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
                <span className="text-xs text-muted-2">본인 · 직접 수정</span>
              </div>

              {members.map((m) => (
                <div
                  key={m.userId}
                  className="rounded-xl border border-border bg-surface px-3 py-2.5"
                >
                  <button
                    onClick={() => (isOwner ? openEdit(m) : undefined)}
                    disabled={!isOwner}
                    className="flex w-full items-center justify-between text-left disabled:cursor-default"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{m.name ?? m.email ?? m.userId}</p>
                      {(m.role || m.counts) && (
                        <p className="truncate text-xs text-muted-2">
                          {[m.role, m.counts].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-accent-light">
                      {m.permission}
                    </span>
                  </button>

                  {editingUserId === m.userId && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
                      <div className="flex flex-col gap-1.5">
                        {PERMISSIONS.map((p) => (
                          <label
                            key={p}
                            className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
                          >
                            <input
                              type="radio"
                              name={`permission-${m.userId}`}
                              checked={draft.permission === p}
                              onChange={() => setDraft((d) => ({ ...d, permission: p }))}
                              className="accent-accent"
                            />
                            <span className="flex-1">
                              <span className="text-foreground">{p}</span>
                              <span className="ml-1.5 text-muted-2">{PERMISSION_HINT[p]}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <input
                        value={draft.role}
                        onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                        placeholder="담당 파트 (예: 포메이션 구성)"
                        className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-accent"
                      />
                      <input
                        value={draft.counts}
                        onChange={(e) => setDraft((d) => ({ ...d, counts: e.target.value }))}
                        placeholder="담당 구간 (예: count 09-16)"
                        className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-accent"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="flex-1 rounded-lg bg-accent py-2 text-xs font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
                        >
                          {saving ? "저장 중…" : "저장"}
                        </button>
                        <button
                          onClick={() => removeMember(m.userId)}
                          disabled={saving}
                          className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                        >
                          내보내기
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="rounded-lg border border-border px-3 py-2 text-xs text-muted transition-colors hover:bg-surface-hover"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
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
                      {copied ? "클립보드에 복사했어요. " : ""}이 링크로 참여하면 기본 권한은
                      &quot;수정 제안&quot;이에요 — 참여 후 멤버 목록에서 권한을 바꿀 수 있어요 ·
                      7일 후 만료
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={leaveProject}
                disabled={saving}
                className="rounded-xl border border-red-500/30 py-3 text-sm text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                이 프로젝트에서 나가기
              </button>
            )}

            {errorMessage && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
                {errorMessage}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
