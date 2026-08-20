"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/TopBar";
import { SkeletonOverlayPlayer } from "@/components/viewer/SkeletonOverlayPlayer";
import { useProjectStore } from "@/lib/store";
import { useCompareStore } from "@/lib/compare/store";
import { SAMPLE_FPS } from "@/lib/poseExtraction";
import { createClient } from "@/lib/supabase/client";
import { fetchProfileNames, displayName, type ProfileNameInfo } from "@/lib/profiles";
import { PoseDataViewer } from "@/components/project/PoseDataViewer";
import { useProjectPermission } from "@/lib/useProjectPermission";

export default function VersionViewerPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const { id: projectId, versionId } = use(params);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const version = useProjectStore((s) => s.versions.find((v) => v.id === versionId));
  const allRuns = useCompareStore((s) => s.runs);
  const { canEdit } = useProjectPermission(projectId, project?.ownerId);

  const [uploader, setUploader] = useState<ProfileNameInfo | undefined>();

  const createdBy = version?.createdBy;
  useEffect(() => {
    if (!createdBy) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const map = await fetchProfileNames(supabase, [createdBy]);
      if (!cancelled) setUploader(map.get(createdBy));
    })();
    return () => {
      cancelled = true;
    };
  }, [createdBy]);

  if (!project || !version) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="버전 뷰어" backHref={`/projects/${projectId}`} />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          버전을 찾을 수 없어요. 새로고침했다면 영상이 세션에서 사라졌을 수 있어요
          (Phase 6에서 영구 저장이 연결됩니다).
        </p>
      </div>
    );
  }

  const totalPersons = Math.max(0, ...version.poseData.map((f) => f.persons.length));
  const runsForVersion = allRuns.filter((r) => r.userVersionId === version.id);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar
        title={`${project.title} · ${version.label}`}
        backHref={`/projects/${projectId}`}
      />

      <div className="flex flex-col gap-3 px-4 pb-8">
        <SkeletonOverlayPlayer version={version} />

        <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted">
          <p>
            만든 사람 <span className="text-foreground">{displayName(uploader)}</span> · 생성일{" "}
            {version.createdAt}
          </p>
          <p>
            포즈 프레임 {version.poseData.length}개 (초당 {SAMPLE_FPS}프레임) · 최대{" "}
            {totalPersons}명 감지
          </p>
        </div>

        <PoseDataViewer poseData={version.poseData} fileName={`${version.label}-pose.json`} />

        <Link
          href={`/projects/${projectId}/compare/new?userVersionId=${version.id}`}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light"
        >
          🆚 비교 분석 시작
        </Link>

        {canEdit && (
          <Link
            href={`/projects/${projectId}/versions/${version.id}/live`}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3 text-sm text-muted transition-colors hover:bg-surface-hover"
          >
            🎥 이 영상 보면서 실시간 연습
          </Link>
        )}

        <Link
          href={`/projects/${projectId}/formation`}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3 text-sm text-muted transition-colors hover:bg-surface-hover"
        >
          🧍 3D 포메이션 뷰
        </Link>

        {runsForVersion.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">이 버전의 비교 기록</p>
            {runsForVersion.map((run) => (
              <Link
                key={run.id}
                href={`/projects/${projectId}/compare/${run.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {run.source.type === "archive"
                      ? "내 아카이브"
                      : run.source.type === "upload"
                        ? "직접 업로드"
                        : run.source.title}
                  </p>
                  <p className="text-xs text-muted">{run.createdAt}</p>
                </div>
                <span className="shrink-0 text-accent-light">
                  {run.result ? `${run.result.overallScore}%` : "AI 조언"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
