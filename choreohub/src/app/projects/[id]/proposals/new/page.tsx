"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { Button } from "@/components/ui/Button";
import { PoseExtractor, type ExtractionResult } from "@/components/upload/PoseExtractor";
import { useProjectStore } from "@/lib/store";
import { useProposalStore } from "@/lib/proposals/store";
import { extensionFromFile } from "@/lib/videoFile";
import { useProjectPermission } from "@/lib/useProjectPermission";

export default function NewProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const addProposal = useProposalStore((s) => s.addProposal);
  const { canPropose, checked } = useProjectPermission(projectId, project?.ownerId);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [startSec, setStartSec] = useState("");
  const [endSec, setEndSec] = useState("");
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!extraction || submitting) return;
    if (!title.trim()) {
      setErrorMessage("제목을 입력해주세요.");
      return;
    }
    const start = Number(startSec);
    const end = Number(endSec);
    if (startSec.trim() === "" || endSec.trim() === "" || Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      setErrorMessage("담당 구간을 초 단위로 올바르게 입력해주세요 (끝이 시작보다 커야 해요).");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await addProposal({
        projectId,
        title: title.trim(),
        note: note.trim(),
        startSec: start,
        endSec: end,
        videoBlob: extraction.file,
        videoExt: extensionFromFile(extraction.file),
        durationSec: extraction.durationSec,
        poseData: extraction.poseData,
      });
      router.push(`/projects/${projectId}/proposals`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "제안 저장에 실패했어요.");
      setSubmitting(false);
    }
  }

  if (!project) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="제안하기" backHref="/dashboard" />
        <p className="px-4 pt-10 text-center text-sm text-muted">프로젝트를 찾을 수 없어요</p>
      </div>
    );
  }

  if (checked && !canPropose) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title={`${project.title} · 제안하기`} backHref={`/projects/${projectId}/proposals`} />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          이 프로젝트에 제안을 올릴 권한이 없어요 — 소유자에게 &quot;수정 제안&quot; 이상 권한을
          요청해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title={`${project.title} · 제안하기`} backHref={`/projects/${projectId}/proposals`} />

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 px-4 pb-8">
        <PoseExtractor onExtracted={setExtraction} />

        <div>
          <label htmlFor="title" className="mb-1.5 block text-xs font-medium text-muted">
            제목 (무엇을 고쳤는지 한 줄로)
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 후렴 팔 동작 변형"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">담당 구간(초 단위)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={0.1}
              value={startSec}
              onChange={(e) => setStartSec(e.target.value)}
              placeholder="시작(초)"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
            />
            <span className="text-muted-2">~</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={endSec}
              onChange={(e) => setEndSec(e.target.value)}
              placeholder="끝(초)"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label htmlFor="note" className="mb-1.5 block text-xs font-medium text-muted">
            메모(선택)
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="왜 이렇게 바꿨는지 적어두면 소유자가 판단하기 쉬워요"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
          />
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          {!extraction && (
            <p className="text-center text-xs text-muted-2">
              영상을 선택하고 포즈 추출을 완료해야 제안을 보낼 수 있어요
            </p>
          )}
          {errorMessage && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
              {errorMessage}
            </p>
          )}
          <Button type="submit" className="flex-1" disabled={!extraction || submitting}>
            {submitting ? "보내는 중…" : "제안 보내기"}
          </Button>
        </div>
      </form>
    </div>
  );
}
