"use client";

import { use, useRef } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/TopBar";
import { ScoreGauge } from "@/components/compare/ScoreGauge";
import { ScoreHeatmap } from "@/components/compare/ScoreHeatmap";
import { DualVideoPlayer, type DualVideoPlayerHandle } from "@/components/compare/DualVideoPlayer";
import { AdviceCard } from "@/components/compare/AdviceCard";
import { YoutubeEmbed } from "@/components/compare/YoutubeEmbed";
import { SkeletonOverlayPlayer } from "@/components/viewer/SkeletonOverlayPlayer";
import { useCompareStore } from "@/lib/compare/store";
import { useProjectStore } from "@/lib/store";

export default function CompareResultPage({
  params,
}: {
  params: Promise<{ id: string; compareId: string }>;
}) {
  const { id: projectId, compareId } = use(params);
  const run = useCompareStore((s) => s.runs.find((r) => r.id === compareId));
  const allVersions = useProjectStore((s) => s.versions);
  const playerRef = useRef<DualVideoPlayerHandle>(null);

  const userVersion = allVersions.find((v) => v.id === run?.userVersionId);

  if (!run) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="비교 결과" backHref={`/projects/${projectId}`} />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          비교 결과를 찾을 수 없어요. 새로고침했다면 세션에서 사라졌을 수 있어요.
        </p>
      </div>
    );
  }

  const isYoutube = run.source.type === "youtube";

  // 재생용 레퍼런스 영상 데이터 소스 결정 (경로 A: 다른 버전 / 경로 B: 업로드 당시 저장해둔 것)
  const source = run.source;
  const refArchiveVersionId = source.type === "archive" ? source.versionId : null;
  const refArchiveVersion = refArchiveVersionId
    ? allVersions.find((v) => v.id === refArchiveVersionId)
    : undefined;
  const refVideo =
    source.type === "archive" && refArchiveVersion
      ? {
          videoUrl: refArchiveVersion.videoUrl,
          poseData: refArchiveVersion.poseData,
          durationSec: refArchiveVersion.durationSec,
          label: refArchiveVersion.label,
        }
      : run.source.type === "upload" && run.refVideo
        ? {
            videoUrl: run.refVideo.videoUrl,
            poseData: run.refVideo.poseData,
            durationSec: run.refVideo.durationSec,
            label: "직접 업로드 영상",
          }
        : null;

  const canPlaySync = !!(userVersion && refVideo);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar
        title={userVersion ? `${userVersion.label} 비교 결과` : "비교 결과"}
        backHref={
          userVersion
            ? `/projects/${projectId}/versions/${userVersion.id}`
            : `/projects/${projectId}`
        }
      />

      <div className="flex flex-col gap-4 px-4 pb-8">
        {isYoutube && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-xs text-accent-light">
            <span>
              이 경로는 AI 서술 피드백만 제공합니다. 일치율 숫자는 내 아카이브 또는 직접
              업로드에서 확인하세요.
            </span>
            <Link
              href={`/projects/${projectId}/compare/new?userVersionId=${run.userVersionId}`}
              className="shrink-0 whitespace-nowrap rounded-lg border border-accent/40 px-2 py-1 text-accent-light hover:bg-accent/10"
            >
              A/B로 전환
            </Link>
          </div>
        )}

        {isYoutube && userVersion && run.source.type === "youtube" && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">내 영상</p>
              <SkeletonOverlayPlayer version={userVersion} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">
                레퍼런스 · {run.source.title}
              </p>
              <YoutubeEmbed videoId={run.source.videoId} title={run.source.title} />
            </div>
          </div>
        )}

        {run.result?.lowVisibility && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            촬영 거리/각도 때문에 몸의 일부가 잘 안 보이는 구간이 있어요 — 그 구간 점수는
            신뢰도가 낮을 수 있어요.
          </p>
        )}

        {run.result && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <ScoreGauge score={run.result.overallScore} />
            {run.result.mirrored && (
              <p className="mt-2 text-center text-xs text-accent-light">거울모드로 매칭됨</p>
            )}
          </div>
        )}

        {run.result && run.result.frameScores.length > 0 && userVersion && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">타임라인 히트맵</p>
            <ScoreHeatmap
              frameScores={run.result.frameScores}
              durationSec={userVersion.durationSec}
              onSeek={(t) => playerRef.current?.seekUserTime(t)}
            />
          </div>
        )}

        {canPlaySync && userVersion && refVideo && (
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
            mirrored={run.result?.mirrored ?? false}
          />
        )}

        {canPlaySync && (
          <Link
            href={`/projects/${projectId}/compare/${compareId}/ranges`}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3 text-sm text-muted transition-colors hover:bg-surface-hover"
          >
            🎯 구간 지정 비교 (특정 부분만 골라 비교)
            {run.rangePairs.length > 0 && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent-light">
                {run.rangePairs.length}개 등록됨
              </span>
            )}
          </Link>
        )}

        {run.result && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">구간별 점수</p>
            {run.result.segments.map((seg) => (
              <div
                key={`${seg.label}-${seg.start}`}
                className="rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{seg.label}</span>
                  <span className="text-accent-light">
                    {seg.score >= 100 ? "정답 (100%)" : `${seg.score}%`}
                  </span>
                </div>
                {seg.worstJoints.length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-0.5">
                    <p className="text-[11px] text-muted-2">차이 큰 관절</p>
                    {seg.worstJoints.map((j) => (
                      <p key={j.joint} className="text-[11px] text-muted-2">
                        {j.joint}: 레퍼런스 {j.refDeg}° → 내 영상 {j.userDeg}° (차이 {j.avgDiffDeg}°)
                      </p>
                    ))}
                  </div>
                )}
                {seg.lowVisibility && (
                  <p className="mt-1 text-[11px] text-amber-300">
                    이 구간은 몸 일부가 잘 안 보여서 신뢰도가 낮아요
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {isYoutube && userVersion && run.source.type === "youtube" && (
          <AdviceCard
            mode="descriptive"
            runId={run.id}
            userVideoUrl={userVersion.videoUrl}
            refYoutubeUrl={run.source.url}
            refTitle={run.source.title}
            advice={run.descriptive}
          />
        )}

        {run.result && userVersion && refVideo && (
          <AdviceCard
            mode="numeric"
            runId={run.id}
            userVideoUrl={userVersion.videoUrl}
            refVideoUrl={refVideo.videoUrl}
            segments={run.result.segments}
            advice={run.advice}
          />
        )}

        <div className="mt-2 flex gap-3">
          {userVersion && (
            <Link
              href={`/projects/${projectId}/versions/${userVersion.id}`}
              className="flex-1 rounded-xl border border-border bg-surface py-3 text-center text-sm text-muted transition-colors hover:bg-surface-hover"
            >
              내 영상으로
            </Link>
          )}
          <Link
            href={`/projects/${projectId}/compare/new?userVersionId=${run.userVersionId}`}
            className="flex-1 rounded-xl bg-accent py-3 text-center text-sm font-medium text-white transition-colors hover:bg-accent-light"
          >
            다시 비교하기
          </Link>
        </div>
      </div>
    </div>
  );
}
