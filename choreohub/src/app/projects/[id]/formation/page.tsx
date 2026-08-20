"use client";

import { use, useEffect } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { StageView } from "@/components/formation/StageView";
import { FormationEditor } from "@/components/formation/FormationEditor";
import { FormationTimeline } from "@/components/formation/FormationTimeline";
import { useFormationStore } from "@/lib/formation/store";
import { useProjectStore } from "@/lib/store";

export default function FormationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const allVersions = useProjectStore((s) => s.versions);
  const versions = allVersions.filter((v) => v.projectId === projectId);

  const ensureProject = useFormationStore((s) => s.ensureProject);
  const proj = useFormationStore((s) => s.byProject[projectId]);
  const selectSection = useFormationStore((s) => s.selectSection);
  const addSection = useFormationStore((s) => s.addSection);
  const viewMode = useFormationStore((s) => s.viewMode);
  const setViewMode = useFormationStore((s) => s.setViewMode);

  useEffect(() => {
    // 여러 버전이 있으면 "가장 처음 만든 버전"이 아니라 "가장 긴 버전"(보통 전체 공연 원본) 길이를
    // 타임라인 총 길이로 쓴다 — 이래야 짧은 버전을 먼저 올렸을 때 타임라인이 잘리지 않는다.
    const longestDurationSec = versions.reduce((max, v) => Math.max(max, v.durationSec), 0);
    ensureProject(projectId, longestDurationSec || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!project) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="3D 포메이션" backHref="/dashboard" />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          프로젝트를 찾을 수 없어요
        </p>
      </div>
    );
  }

  if (!proj) return null; // ensureProject 이펙트가 아직 안 돌았을 때의 첫 렌더

  const section = proj.sections.find((s) => s.id === proj.selectedSectionId);
  const count = section?.formation.dancers.length ?? 0;

  return (
    <div className="mx-auto flex h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title={`${project.title} · 3D 포메이션`} backHref={`/projects/${projectId}`} />

      <div className="flex items-center gap-2 px-4 pb-3">
        <select
          value={proj.selectedSectionId}
          onChange={(e) => selectSection(projectId, e.target.value)}
          className="flex-1 appearance-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
        >
          {[...proj.sections]
            .sort((a, b) => a.startSec - b.startSec)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
        <button
          onClick={() => addSection(projectId)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-hover"
          title="구간 추가"
        >
          +
        </button>
        <span className="whitespace-nowrap rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
          {count}명
        </span>
      </div>

      <div className="px-4 pb-3">
        <FormationTimeline projectId={projectId} />
      </div>

      <div className="relative mx-4 mb-3 min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-background">
        {viewMode === "3d" ? (
          <StageView projectId={projectId} />
        ) : (
          <FormationEditor projectId={projectId} />
        )}
      </div>

      <div className="flex gap-3 px-4 pb-6">
        <button
          onClick={() => setViewMode(viewMode === "3d" ? "2d" : "3d")}
          className="flex-1 rounded-xl border border-border bg-surface py-3 text-sm text-muted transition-colors hover:bg-surface-hover active:scale-[0.98]"
        >
          {viewMode === "3d" ? "포메이션 편집 (2D)" : "3D로 보기"}
        </button>
      </div>
    </div>
  );
}
