"use client";

import { use } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { LivePracticeSession } from "@/components/live/LivePracticeSession";
import { useProjectStore } from "@/lib/store";

export default function LivePracticePage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const { id: projectId, versionId } = use(params);
  const version = useProjectStore((s) => s.versions.find((v) => v.id === versionId));

  if (!version) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="실시간 연습" backHref={`/projects/${projectId}`} />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          버전을 찾을 수 없어요. 새로고침했다면 영상이 세션에서 사라졌을 수 있어요.
        </p>
      </div>
    );
  }

  if (version.poseData.length === 0) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar
          title="실시간 연습"
          backHref={`/projects/${projectId}/versions/${versionId}`}
        />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          이 버전은 포즈 프레임이 0개예요 — 실시간 채점을 하려면 사람이 잘 보이는 다른
          버전을 레퍼런스로 골라주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar
        title={`${version.label} 보면서 연습`}
        backHref={`/projects/${projectId}/versions/${versionId}`}
      />
      <LivePracticeSession projectId={projectId} referenceVersion={version} />
    </div>
  );
}
