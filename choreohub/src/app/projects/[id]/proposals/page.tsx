"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/TopBar";
import { useProjectStore } from "@/lib/store";
import { useProposalStore } from "@/lib/proposals/store";
import { useProjectPermission } from "@/lib/useProjectPermission";
import { createClient } from "@/lib/supabase/client";
import { fetchProfileNames, displayName, type ProfileNameInfo } from "@/lib/profiles";
import type { Proposal } from "@/lib/types";

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ProposalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const allProposals = useProposalStore((s) => s.proposals);
  const proposals = allProposals
    .filter((p) => p.projectId === projectId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const approveProposal = useProposalStore((s) => s.approveProposal);
  const declineProposal = useProposalStore((s) => s.declineProposal);
  const withdrawProposal = useProposalStore((s) => s.withdrawProposal);
  const { canPropose } = useProjectPermission(projectId, project?.ownerId);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [names, setNames] = useState<Map<string, ProfileNameInfo>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [{ data }, map] = await Promise.all([
        supabase.auth.getUser(),
        fetchProfileNames(supabase, proposals.map((p) => p.authorId)),
      ]);
      if (cancelled) return;
      setCurrentUserId(data.user?.id ?? null);
      setNames(map);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, proposals.length]);

  const isOwner = !!currentUserId && !!project && currentUserId === project.ownerId;

  async function handleApprove(p: Proposal) {
    setBusyId(p.id);
    setErrorMessage(null);
    try {
      await approveProposal(p.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "반영에 실패했어요.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(p: Proposal) {
    setBusyId(p.id);
    setErrorMessage(null);
    try {
      await declineProposal(p.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "거절에 실패했어요.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleWithdraw(p: Proposal) {
    if (!window.confirm("이 제안을 철회할까요?")) return;
    setBusyId(p.id);
    setErrorMessage(null);
    try {
      await withdrawProposal(p.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "철회에 실패했어요.");
    } finally {
      setBusyId(null);
    }
  }

  if (!project) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="수정 제안" backHref="/dashboard" />
        <p className="px-4 pt-10 text-center text-sm text-muted">프로젝트를 찾을 수 없어요.</p>
      </div>
    );
  }

  const open = proposals.filter((p) => p.status === "proposed");
  const decided = proposals.filter((p) => p.status !== "proposed");

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title={`${project.title} · 수정 제안`} backHref={`/projects/${projectId}`} />

      <div className="flex flex-col gap-4 px-4 pb-8">
        {canPropose && (
          <Link
            href={`/projects/${projectId}/proposals/new`}
            className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light"
          >
            + 제안하기
          </Link>
        )}

        {errorMessage && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            {errorMessage}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">열린 제안 {open.length}건</p>
          {open.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-center text-sm text-muted">
              아직 열린 제안이 없어요.
            </p>
          ) : (
            open.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{p.title}</span>
                  <span className="text-xs text-accent-light">
                    {formatSec(p.startSec)}~{formatSec(p.endSec)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-2">
                  {displayName(names.get(p.authorId))} · {p.createdAt}
                </p>
                {p.note && <p className="mt-1.5 text-xs text-muted">{p.note}</p>}
                <div className="mt-2 flex gap-2">
                  {isOwner && (
                    <>
                      <button
                        onClick={() => handleApprove(p)}
                        disabled={busyId === p.id}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
                      >
                        {busyId === p.id ? "처리 중…" : "반영"}
                      </button>
                      <button
                        onClick={() => handleDecline(p)}
                        disabled={busyId === p.id}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      >
                        거절
                      </button>
                    </>
                  )}
                  {currentUserId === p.authorId && (
                    <button
                      onClick={() => handleWithdraw(p)}
                      disabled={busyId === p.id}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
                    >
                      철회
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {decided.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">처리된 제안</p>
            {decided.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-surface/60 px-3 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate text-foreground">{p.title}</p>
                  <p className="text-muted-2">{displayName(names.get(p.authorId))}</p>
                </div>
                <span
                  className={
                    p.status === "merged" ? "text-accent-light" : "text-muted-2 line-through"
                  }
                >
                  {p.status === "merged" ? "반영됨" : "거절됨"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
