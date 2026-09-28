"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/TopBar";
import { ArchiveTab } from "@/components/compare/ArchiveTab";
import { UploadTab } from "@/components/compare/UploadTab";
import { YoutubeTab } from "@/components/compare/YoutubeTab";
import { useProjectStore } from "@/lib/store";
import { useCompareStore, type NewCompareRunInput } from "@/lib/compare/store";
import { compareSequences } from "@/lib/compare/pose-compare";
import { extensionFromFile } from "@/lib/videoFile";
import type { ExtractionResult } from "@/components/upload/PoseExtractor";
import type { YoutubeSearchResult } from "@/app/api/youtube/search/route";

type Tab = "archive" | "upload" | "youtube";

const TABS: { key: Tab; label: string; sub?: string }[] = [
  { key: "archive", label: "내 아카이브" },
  { key: "upload", label: "직접 업로드" },
  { key: "youtube", label: "유튜브 검색", sub: "유튜브 영상과 비교" },
];

export default function NewComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ userVersionId?: string }>;
}) {
  const { id: projectId } = use(params);
  const { userVersionId } = use(searchParams);
  const router = useRouter();

  const allVersions = useProjectStore((s) => s.versions);
  const addRun = useCompareStore((s) => s.addRun);
  const [tab, setTab] = useState<Tab>("archive");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const userVersion = userVersionId ? allVersions.find((v) => v.id === userVersionId) : undefined;

  if (!userVersionId || !userVersion) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="비교 분석" backHref={`/projects/${projectId}`} />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          먼저 비교할 내 영상(버전)을 선택해주세요 — 버전 뷰어에서 &quot;비교 분석
          시작&quot; 버튼으로 들어와주세요.
        </p>
      </div>
    );
  }

  async function saveRunAndGo(input: NewCompareRunInput) {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const run = await addRun(input);
      router.push(`/projects/${projectId}/compare/${run.id}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "저장에 실패했어요.");
      setSubmitting(false);
    }
  }

  function handleArchiveSelect(refVersionId: string) {
    const refVersion = allVersions.find((v) => v.id === refVersionId);
    if (!refVersion || !userVersion) return;
    setErrorMessage(null);
    try {
      const score = compareSequences(userVersion.poseData, refVersion.poseData);
      saveRunAndGo({
        projectId,
        userVersionId: userVersion.id,
        source: { type: "archive", versionId: refVersion.id, projectId: refVersion.projectId },
        result: { ...score, referenceKind: "archive" },
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "비교에 실패했어요.");
    }
  }

  function handleUploadExtracted(extraction: ExtractionResult) {
    if (!userVersion) return;
    setErrorMessage(null);
    try {
      const score = compareSequences(userVersion.poseData, extraction.poseData);
      saveRunAndGo({
        projectId,
        userVersionId: userVersion.id,
        source: { type: "upload", consentGiven: true },
        result: { ...score, referenceKind: "upload" },
        refVideo: {
          blob: extraction.file,
          ext: extensionFromFile(extraction.file),
          poseData: extraction.poseData,
          durationSec: extraction.durationSec,
        },
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "비교에 실패했어요.");
    }
  }

  function handleYoutubeSelect(video: YoutubeSearchResult) {
    if (!userVersion) return;
    saveRunAndGo({
      projectId,
      userVersionId: userVersion.id,
      source: {
        type: "youtube",
        videoId: video.videoId,
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
        title: video.title,
        channelTitle: video.channelTitle,
      },
    });
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="레퍼런스 선택" backHref={`/projects/${projectId}`} />

      <p className="px-4 pb-2 text-xs text-muted">
        &quot;{userVersion.label}&quot;({userVersion.poseData.length}프레임)과 비교할 레퍼런스를
        골라주세요
      </p>

      {userVersion.poseData.length === 0 && (
        <p className="mx-4 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          이 버전은 포즈 프레임이 0개예요 — 이 상태로는 어떤 레퍼런스와 비교해도 0%가 나와요.
          영상에서 사람이 잘 보이는 다른 버전으로 시도해주세요.
        </p>
      )}

      {errorMessage && (
        <p className="mx-4 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-2 px-4 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-accent text-white"
                : "border border-border bg-surface text-muted hover:bg-surface-hover"
            }`}
          >
            {t.label}
            {t.sub && (
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  tab === t.key ? "bg-white/20" : "bg-accent/15 text-accent-light"
                }`}
              >
                {t.sub}
              </span>
            )}
          </button>
        ))}
      </div>

      {submitting ? (
        <p className="px-4 pb-8 text-center text-sm text-muted">저장하는 중…</p>
      ) : (
        <div className="flex-1 px-4 pb-8">
          {tab === "archive" && (
            <ArchiveTab excludeVersionId={userVersion.id} onSelect={handleArchiveSelect} />
          )}
          {tab === "upload" && <UploadTab onExtracted={handleUploadExtracted} />}
          {tab === "youtube" && (
            <YoutubeTab userVersion={userVersion} onSelect={handleYoutubeSelect} />
          )}
        </div>
      )}
    </div>
  );
}
