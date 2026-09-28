"use client";

import { use, useEffect, useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { useProjectStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { fetchProfileNames, displayName, type ProfileNameInfo } from "@/lib/profiles";
import {
  fetchIncomingAccessRequests,
  decideAccessRequest,
  type AccessRequestRow,
} from "@/lib/community/api";

export default function ProjectRequestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [requests, setRequests] = useState<AccessRequestRow[]>([]);
  const [names, setNames] = useState<Map<string, ProfileNameInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setCurrentUserId(user?.id ?? null);

      try {
        const rows = await fetchIncomingAccessRequests(supabase, projectId);
        if (cancelled) return;
        setRequests(rows);
        const nameMap = await fetchProfileNames(
          supabase,
          rows.map((r) => r.requesterId),
        );
        if (!cancelled) setNames(nameMap);
      } catch (err) {
        if (!cancelled) setErrorMessage(err instanceof Error ? err.message : "불러오지 못했어요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleDecide(requestId: string, approve: boolean) {
    setDecidingId(requestId);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      await decideAccessRequest(supabase, requestId, approve);
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: approve ? "승인" : "거절" } : r)),
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "처리에 실패했어요.");
    } finally {
      setDecidingId(null);
    }
  }

  if (!project) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="요청함" backHref="/dashboard" />
        <p className="px-4 pt-10 text-center text-sm text-muted">프로젝트를 찾을 수 없어요.</p>
      </div>
    );
  }

  if (currentUserId !== null && currentUserId !== project.ownerId) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="요청함" backHref={`/projects/${projectId}`} />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          소유자만 볼 수 있는 화면이에요.
        </p>
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "대기");
  const decided = requests.filter((r) => r.status !== "대기");

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title={`${project.title} · 요청함`} backHref={`/projects/${projectId}`} />

      <div className="flex flex-col gap-4 px-4 pb-8">
        {loading ? (
          <p className="pt-10 text-center text-sm text-muted">불러오는 중…</p>
        ) : requests.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted">
            아직 들어온 다운로드/사용 요청이 없어요.
          </p>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">대기중 {pending.length}건</p>
                {pending.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {displayName(names.get(r.requesterId))} · {r.type}
                      </p>
                      <p className="text-xs text-muted-2">{r.createdAt}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => handleDecide(r.id, true)}
                        disabled={decidingId === r.id}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => handleDecide(r.id, false)}
                        disabled={decidingId === r.id}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      >
                        거절
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {decided.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">처리됨</p>
                {decided.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 opacity-70"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {displayName(names.get(r.requesterId))} · {r.type}
                      </p>
                      <p className="text-xs text-muted-2">{r.createdAt}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {errorMessage && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
