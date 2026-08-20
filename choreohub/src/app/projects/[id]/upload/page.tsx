"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { Button } from "@/components/ui/Button";
import { PoseExtractor, type ExtractionResult } from "@/components/upload/PoseExtractor";
import { useProjectStore } from "@/lib/store";
import { extensionFromFile } from "@/lib/videoFile";
import { useProjectPermission } from "@/lib/useProjectPermission";

export default function AddVersionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const allVersions = useProjectStore((s) => s.versions);
  const versions = allVersions.filter((v) => v.projectId === projectId);
  const addVersion = useProjectStore((s) => s.addVersion);
  const { canEdit, checked } = useProjectPermission(projectId, project?.ownerId);

  const [label, setLabel] = useState(`v${versions.length + 1}`);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!extraction || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const version = await addVersion({
        projectId,
        label: label.trim() || `v${versions.length + 1}`,
        videoBlob: extraction.file,
        videoExt: extensionFromFile(extraction.file),
        durationSec: extraction.durationSec,
        poseData: extraction.poseData,
      });
      router.push(`/projects/${projectId}/versions/${version.id}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "버전 저장에 실패했어요.");
      setSubmitting(false);
    }
  }

  if (!project) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="새 버전" backHref="/dashboard" />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          프로젝트를 찾을 수 없어요
        </p>
      </div>
    );
  }

  if (checked && !canEdit) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title={`${project.title} · 새 버전`} backHref={`/projects/${projectId}`} />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          이 프로젝트에서 새 버전을 추가할 권한이 없어요 — 소유자에게 &quot;직접 수정&quot;
          권한을 요청해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title={`${project.title} · 새 버전`} backHref={`/projects/${projectId}`} />

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 px-4 pb-8">
        <PoseExtractor onExtracted={setExtraction} />

        <div>
          <label htmlFor="label" className="mb-1.5 block text-xs font-medium text-muted">
            버전 이름
          </label>
          <input
            id="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
          />
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          {!extraction && (
            <p className="text-center text-xs text-muted-2">
              영상을 선택하고 포즈 추출을 완료해야 버전을 추가할 수 있어요
            </p>
          )}
          {errorMessage && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
              {errorMessage}
            </p>
          )}
          <Button type="submit" className="flex-1" disabled={!extraction || submitting}>
            {submitting ? "저장 중…" : "버전 추가"}
          </Button>
        </div>
      </form>
    </div>
  );
}
