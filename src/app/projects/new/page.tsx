"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { Button } from "@/components/ui/Button";
import { PoseExtractor, type ExtractionResult } from "@/components/upload/PoseExtractor";
import { useProjectStore } from "@/lib/store";
import { extensionFromFile } from "@/lib/videoFile";

const THUMBNAIL_COLORS = [
  "from-violet-600 to-fuchsia-700",
  "from-indigo-600 to-violet-700",
  "from-purple-600 to-pink-700",
  "from-fuchsia-600 to-purple-800",
];

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-2 focus:border-accent";

export default function NewProjectPage() {
  const router = useRouter();
  const addProject = useProjectStore((s) => s.addProject);
  const addVersion = useProjectStore((s) => s.addVersion);

  const [title, setTitle] = useState("");
  const [songName, setSongName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasUnprocessedFile = pendingFile !== null && extraction === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || hasUnprocessedFile || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const project = await addProject({
        title: title.trim(),
        songName: songName.trim() || "곡 미지정",
        bpm: null,
        description: description.trim(),
        status: "in_progress",
        memberCount: 1,
        isPublic,
        thumbnailColor:
          THUMBNAIL_COLORS[Math.floor(Math.random() * THUMBNAIL_COLORS.length)],
      }
    );

      if (extraction) {
        const version = await addVersion({
          projectId: project.id,
          label: "v1",
          videoBlob: extraction.file,
          videoExt: extensionFromFile(extraction.file),
          durationSec: extraction.durationSec,
          poseData: extraction.poseData,
        });
        router.push(`/projects/${project.id}/versions/${version.id}`);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "프로젝트 생성에 실패했어요.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="새 프로젝트" backHref="/dashboard" />

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 px-4 pb-8">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">
            영상 업로드 (선택)
          </label>
          <PoseExtractor
            onFileChange={setPendingFile}
            onExtracted={setExtraction}
          />
        </div>

        <div>
          <label htmlFor="title" className="mb-1.5 block text-xs font-medium text-muted">
            프로젝트 이름 *
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 가을 정기공연 메인 무대"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label htmlFor="song" className="mb-1.5 block text-xs font-medium text-muted">
            음악
          </label>
          <input
            id="song"
            value={songName}
            onChange={(e) => setSongName(e.target.value)}
            placeholder="아티스트 - 곡 제목"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="desc" className="mb-1.5 block text-xs font-medium text-muted">
            설명
          </label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="이 프로젝트에 대한 메모"
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">공개 범위</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                !isPublic
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-surface text-muted hover:bg-surface-hover"
              }`}
            >
              <span className="block font-medium">🔒 비공개</span>
              <span className="block text-[11px] text-muted-2">
                승인된 멤버만 볼 수 있어요
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                isPublic
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-surface text-muted hover:bg-surface-hover"
              }`}
            >
              <span className="block font-medium">🌐 전체 공개</span>
              <span className="block text-[11px] text-muted-2">
                로그인한 누구나 볼 수 있어요
              </span>
            </button>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          {hasUnprocessedFile && (
            <p className="text-center text-xs text-muted-2">
              영상을 선택했으면 먼저 &quot;포즈 추출 시작&quot;을 눌러주세요
            </p>
          )}
          {errorMessage && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
              {errorMessage}
            </p>
          )}
          <Button type="submit" className="flex-1" disabled={hasUnprocessedFile || submitting}>
            {submitting ? "만드는 중…" : "프로젝트 만들기"}
          </Button>
        </div>
      </form>
    </div>
  );
}
