"use client";

import { useProjectStore } from "@/lib/store";

interface Props {
  excludeVersionId: string;
  onSelect: (versionId: string) => void;
}

export function ArchiveTab({ excludeVersionId, onSelect }: Props) {
  const projects = useProjectStore((s) => s.projects);
  const allVersions = useProjectStore((s) => s.versions);
  const candidates = allVersions.filter((v) => v.id !== excludeVersionId && v.poseData.length > 0);

  if (candidates.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-center text-sm text-muted">
        비교할 수 있는 다른 영상이 아직 없어요. 포즈 추출이 끝난 다른 버전을 먼저 만들어보세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-2">
        전에 올린 내 영상 중 하나를 골라 바로 비교해요. 이미 추출된 포즈 데이터를 그대로
        재사용하니 다시 분석할 필요 없어요.
      </p>
      {candidates.map((v) => {
        const project = projects.find((p) => p.id === v.projectId);
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
          >
            <div>
              <p className="text-sm text-foreground">{v.label}</p>
              <p className="text-xs text-muted">
                {project?.title ?? "알 수 없는 프로젝트"} · {v.createdAt} · {v.poseData.length}
                프레임
              </p>
            </div>
            <span className="text-muted">›</span>
          </button>
        );
      })}
    </div>
  );
}
