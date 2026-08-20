"use client";

import { use, useRef, useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { RangeTimeline } from "@/components/compare/RangeTimeline";
import { DualVideoPlayer, type DualVideoPlayerHandle } from "@/components/compare/DualVideoPlayer";
import { RangePairAdvice } from "@/components/compare/RangePairAdvice";
import { SceneThumbnail } from "@/components/compare/SceneThumbnail";
import { useCompareStore } from "@/lib/compare/store";
import { useProjectStore } from "@/lib/store";
import { compareRangePair, findBestMatchingRange } from "@/lib/compare/pose-compare";
import type { TimeRange } from "@/lib/compare/types";

export default function RangeComparePage({
  params,
}: {
  params: Promise<{ id: string; compareId: string }>;
}) {
  const { id: projectId, compareId } = use(params);
  const run = useCompareStore((s) => s.runs.find((r) => r.id === compareId));
  const addRangePair = useCompareStore((s) => s.addRangePair);
  const removeRangePair = useCompareStore((s) => s.removeRangePair);
  const allVersions = useProjectStore((s) => s.versions);
  const playerRef = useRef<DualVideoPlayerHandle>(null);

  const userVersion = allVersions.find((v) => v.id === run?.userVersionId);
  const source = run?.source;
  const refArchiveVersionId = source?.type === "archive" ? source.versionId : null;
  const refArchiveVersion = refArchiveVersionId
    ? allVersions.find((v) => v.id === refArchiveVersionId)
    : undefined;
  const refVideo =
    source?.type === "archive" && refArchiveVersion
      ? {
          videoUrl: refArchiveVersion.videoUrl,
          poseData: refArchiveVersion.poseData,
          durationSec: refArchiveVersion.durationSec,
          label: refArchiveVersion.label,
        }
      : source?.type === "upload" && run?.refVideo
        ? {
            videoUrl: run.refVideo.videoUrl,
            poseData: run.refVideo.poseData,
            durationSec: run.refVideo.durationSec,
            label: "직접 업로드 영상",
          }
        : null;

  const [userRange, setUserRange] = useState<TimeRange>({ start: 0, end: Math.min(10, userVersion?.durationSec ?? 10) });
  const [refRange, setRefRange] = useState<TimeRange>({ start: 0, end: Math.min(10, refVideo?.durationSec ?? 10) });
  const [label, setLabel] = useState("");
  const [previewPairId, setPreviewPairId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Array<{ start: number; end: number; score: number }>>([]);
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!run || !userVersion || !refVideo) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="구간 지정 비교" backHref={`/projects/${projectId}/compare/${compareId}`} />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          구간 지정 비교는 내 아카이브/직접 업로드 경로(포즈 데이터가 있는 비교)에서만 사용할 수
          있어요.
        </p>
      </div>
    );
  }

  async function addPair(pair: { userRange: TimeRange; refRange: TimeRange; label?: string }) {
    setErrorMessage(null);
    try {
      const result = compareRangePair(
        userVersion!.poseData,
        refVideo!.poseData,
        pair.userRange,
        pair.refRange,
        pair.label,
      );
      await addRangePair(run!.id, result);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "비교에 실패했어요.");
    }
  }

  function handleAddPair() {
    addPair({ userRange, refRange, label: label.trim() || undefined });
    setLabel("");
  }

  function handleAutoFind() {
    setSearching(true);
    setErrorMessage(null);
    setCandidates([]);
    try {
      const userClip = userVersion!.poseData.filter(
        (f) => f.timestamp >= userRange.start && f.timestamp <= userRange.end,
      );
      const found = findBestMatchingRange(userClip, refVideo!.poseData, 0.5);
      if (found.length === 0) {
        setErrorMessage("비슷한 구간을 찾지 못했어요.");
      }
      setCandidates(found);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "자동 찾기에 실패했어요.");
    } finally {
      setSearching(false);
    }
  }

  function handlePickCandidate(c: { start: number; end: number; score: number }) {
    const newRefRange = { start: c.start, end: c.end };
    setRefRange(newRefRange);
    addPair({ userRange, refRange: newRefRange, label: label.trim() || undefined });
    setLabel("");
    setCandidates([]);
  }

  const previewPair = run.rangePairs.find((p) => p.id === previewPairId);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title="구간 지정 비교" backHref={`/projects/${projectId}/compare/${compareId}`} />

      <div className="flex flex-col gap-4 px-4 pb-8">
        <p className="text-xs text-muted">
          두 영상에서 원하는 구간을 각각 골라 그 부분만 비교해요. 길이가 달라도 자동으로
          맞춰 정렬돼요.
        </p>

        <RangeTimeline
          label={`내 영상 · ${userVersion.label} (${userVersion.durationSec.toFixed(0)}초)`}
          durationSec={userVersion.durationSec}
          range={userRange}
          onChange={setUserRange}
          colorClass="bg-accent/70 border-accent"
        />
        <RangeTimeline
          label={`레퍼런스 · ${refVideo.label} (${refVideo.durationSec.toFixed(0)}초)`}
          durationSec={refVideo.durationSec}
          range={refRange}
          onChange={setRefRange}
          colorClass="bg-fuchsia-600/70 border-fuchsia-400"
        />

        {Math.abs(userRange.end - userRange.start) > 0 &&
          Math.abs(refRange.end - refRange.start) > 0 &&
          (() => {
            const uLen = userRange.end - userRange.start;
            const rLen = refRange.end - refRange.start;
            const ratio = Math.max(uLen / rLen, rLen / uLen);
            return ratio >= 2 ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                구간 길이 차이가 커요 (한쪽이 다른 쪽의 {ratio.toFixed(1)}배) — 그래도 비교는
                되지만 결과가 부정확할 수 있어요.
              </p>
            ) : null;
          })()}

        <div className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="라벨(선택) — 예: 후렴 대조"
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            onClick={handleAddPair}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light"
          >
            구간쌍 추가
          </button>
        </div>

        <button
          onClick={handleAutoFind}
          disabled={searching}
          className="rounded-xl border border-border bg-surface py-2.5 text-sm text-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
        >
          {searching ? "레퍼런스 탐색 중…" : "레퍼런스에서 비슷한 구간 자동 찾기"}
        </button>

        {errorMessage && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            {errorMessage}
          </p>
        )}

        {candidates.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted">후보 (클릭하면 구간쌍으로 바로 등록돼요)</p>
            {candidates.map((c, i) => (
              <button
                key={i}
                onClick={() => handlePickCandidate(c)}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs transition-colors hover:bg-surface-hover"
              >
                <span className="text-foreground">
                  레퍼런스 {c.start.toFixed(1)}s~{c.end.toFixed(1)}s
                </span>
                <span className="text-accent-light">{c.score}% 일치</span>
              </button>
            ))}
          </div>
        )}

        {run.rangePairs.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">등록된 구간쌍</p>
            {run.rangePairs.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl border p-3 ${
                  previewPairId === p.id ? "border-accent bg-accent/10" : "border-border bg-surface"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <button
                    onClick={() => setPreviewPairId(p.id)}
                    className="text-left text-foreground hover:text-accent-light"
                  >
                    {p.label || "구간쌍"} · 내 {p.userRange.start.toFixed(1)}~
                    {p.userRange.end.toFixed(1)}s / 레퍼런스 {p.refRange.start.toFixed(1)}~
                    {p.refRange.end.toFixed(1)}s
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-accent-light">
                      {p.score >= 100 ? "정답 (100%)" : `${p.score}%`}
                    </span>
                    <button
                      onClick={() => {
                        removeRangePair(run.id, p.id);
                        if (previewPairId === p.id) setPreviewPairId(null);
                      }}
                      className="text-muted-2 hover:text-red-400"
                      aria-label="삭제"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <SceneThumbnail
                    videoUrl={userVersion.videoUrl}
                    time={p.userRange.start}
                    label="내 영상"
                  />
                  <SceneThumbnail
                    videoUrl={refVideo.videoUrl}
                    time={p.refRange.start}
                    label="레퍼런스"
                  />
                </div>
                {p.lengthWarning && (
                  <p className="mt-1 text-[11px] text-amber-300">구간 길이 차이가 커요</p>
                )}
                {p.lowVisibility && (
                  <p className="mt-1 text-[11px] text-amber-300">
                    몸 일부가 잘 안 보여서 신뢰도가 낮아요
                  </p>
                )}
                {p.worstJoints.length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-0.5">
                    <p className="text-[11px] text-muted-2">차이 큰 관절</p>
                    {p.worstJoints.map((j) => (
                      <p key={j.joint} className="text-[11px] text-muted-2">
                        {j.joint}: 레퍼런스 {j.refDeg}° → 내 영상 {j.userDeg}° (차이 {j.avgDiffDeg}°)
                      </p>
                    ))}
                  </div>
                )}
                <RangePairAdvice
                  runId={run.id}
                  pair={p}
                  userVideoUrl={userVersion.videoUrl}
                  refVideoUrl={refVideo.videoUrl}
                />
              </div>
            ))}
          </div>
        )}

        {previewPair && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">
              {previewPair.label || "구간쌍"} 반복 재생
            </p>
            <DualVideoPlayer
              ref={playerRef}
              userVideoUrl={userVersion.videoUrl}
              userPoseData={userVersion.poseData}
              userDurationSec={userVersion.durationSec}
              userLabel={`내 영상 · ${userVersion.label}`}
              refVideoUrl={refVideo.videoUrl}
              refPoseData={refVideo.poseData}
              refDurationSec={refVideo.durationSec}
              refLabel={`레퍼런스 · ${refVideo.label}`}
              mirrored={previewPair.mirrored}
              userRange={previewPair.userRange}
              refRange={previewPair.refRange}
              loop
            />
          </div>
        )}
      </div>
    </div>
  );
}
