"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/TopBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useProjectStore } from "@/lib/store";
import { useCompareStore } from "@/lib/compare/store";
import { useProposalStore } from "@/lib/proposals/store";
import { createClient } from "@/lib/supabase/client";
import { fetchProfileNames, displayName, type ProfileNameInfo } from "@/lib/profiles";
import { useProjectPermission } from "@/lib/useProjectPermission";
import { CreditTimeline } from "@/components/project/CreditTimeline";
import type { ProjectLicense } from "@/lib/types";

const LICENSES: ProjectLicense[] = ["연습 전용", "비상업 커버 허용", "리믹스 허용", "사전승인 필요"];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === id));
  const allVersions = useProjectStore((s) => s.versions);
  const versions = allVersions.filter((v) => v.projectId === id);
  const allRuns = useCompareStore((s) => s.runs);
  const compareRuns = allRuns.filter((r) => r.projectId === id);
  const allProposals = useProposalStore((s) => s.proposals);
  const openProposalCount = allProposals.filter(
    (p) => p.projectId === id && p.status === "proposed",
  ).length;
  const updateProjectLicense = useProjectStore((s) => s.updateProjectLicense);

  const { canEdit } = useProjectPermission(id, project?.ownerId);
  const [names, setNames] = useState<Map<string, ProfileNameInfo>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [savingLicense, setSavingLicense] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const uploaderIds = versions.map((v) => v.createdBy);
      const [map, userResult] = await Promise.all([
        fetchProfileNames(supabase, uploaderIds),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      setNames(map);
      setCurrentUserId(userResult.data.user?.id ?? null);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, versions.length]);

  const isOwner = !!currentUserId && !!project && currentUserId === project.ownerId;

  async function handleLicenseChange(license: ProjectLicense) {
    if (!project || savingLicense) return;
    setSavingLicense(true);
    try {
      await updateProjectLicense(project.id, license);
    } catch {
      // 실패해도 조용히 무시 — 화면은 이전 값을 유지한다.
    } finally {
      setSavingLicense(false);
    }
  }

  if (!project) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="프로젝트" backHref="/dashboard" />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          프로젝트를 찾을 수 없어요
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar
        title={project.title}
        backHref="/dashboard"
        right={
          <Link
            href={`/projects/${id}/members`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-base leading-none text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="멤버"
            title="멤버"
          >
            👥
          </Link>
        }
      />

      <div className={`mx-4 h-32 rounded-2xl bg-gradient-to-br ${project.thumbnailColor}`} />

      <div className="flex flex-col gap-4 px-4 py-5">
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          <span className="text-xs text-muted">최근 수정 {project.updatedAt}</span>
        </div>

        <div>
          <p className="text-sm text-foreground">{project.songName}</p>
          {project.bpm && <p className="text-xs text-muted">BPM {project.bpm}</p>}
        </div>

        {project.description && (
          <p className="text-sm leading-relaxed text-muted">{project.description}</p>
        )}

        <div className="flex gap-4 text-xs text-muted-2">
          <span>인원 {project.memberCount}명</span>
          <span>버전 {versions.length}개</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="mb-1.5 text-xs font-medium text-muted">라이선스</p>
          {isOwner ? (
            <div className="flex flex-wrap gap-1.5">
              {LICENSES.map((l) => (
                <button
                  key={l}
                  onClick={() => handleLicenseChange(l)}
                  disabled={savingLicense}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                    project.license === l
                      ? "bg-accent text-white"
                      : "border border-border text-muted hover:bg-surface-hover"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-foreground">{project.license}</span>
          )}
        </div>

        <CreditTimeline versions={versions} names={names} />

        <Link
          href={`/projects/${id}/proposals`}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3 text-sm text-muted transition-colors hover:bg-surface-hover"
        >
          📝 수정 제안
          {openProposalCount > 0 && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent-light">
              {openProposalCount}건 대기
            </span>
          )}
        </Link>

        <div className="mt-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">버전 타임라인</h2>
          {canEdit && (
            <Link
              href={`/projects/${id}/upload`}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-hover"
            >
              + 새 버전 추가
            </Link>
          )}
        </div>

        {versions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-4 text-center text-sm text-muted">
            아직 버전이 없어요. 영상을 올려서 첫 버전을 만들어보세요.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {versions.map((v) => (
              <Link
                key={v.id}
                href={`/projects/${id}/versions/${v.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-hover"
              >
                <div>
                  <p className="text-sm text-foreground">
                    {v.label}
                    {v.coversStart != null && v.coversEnd != null && (
                      <span className="ml-1.5 text-xs text-accent-light">
                        {Math.floor(v.coversStart)}s~{Math.ceil(v.coversEnd)}s 구간
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {displayName(names.get(v.createdBy))} · {v.createdAt} · {v.poseData.length}
                    프레임
                  </p>
                </div>
                <span className="text-muted">›</span>
              </Link>
            ))}
          </div>
        )}

        <Link
          href={`/projects/${id}/formation`}
          className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light"
        >
          🧍 3D 포메이션 뷰
        </Link>

        <div className="mt-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">비교 분석 기록</h2>
        </div>

        {compareRuns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-4 text-center text-sm text-muted">
            {versions.length === 0
              ? "버전을 먼저 만들면 비교 분석을 시작할 수 있어요."
              : "아직 비교한 기록이 없어요 — 위 버전 목록에서 버전을 하나 열고 \"비교 분석 시작\"을 눌러보세요."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {compareRuns.map((run) => {
              const userVersion = allVersions.find((v) => v.id === run.userVersionId);
              const source = run.source;
              const refVersionId = source.type === "archive" ? source.versionId : null;
              const refLabel =
                source.type === "archive"
                  ? (allVersions.find((v) => v.id === refVersionId)?.label ?? "내 아카이브")
                  : source.type === "upload"
                    ? "직접 업로드 영상"
                    : source.title;
              return (
                <Link
                  key={run.id}
                  href={`/projects/${id}/compare/${run.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {userVersion?.label ?? "버전"} vs {refLabel}
                    </p>
                    <p className="text-xs text-muted">{run.createdAt}</p>
                  </div>
                  <span className="shrink-0 text-accent-light">
                    {run.result ? `${run.result.overallScore}%` : "AI 조언"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
