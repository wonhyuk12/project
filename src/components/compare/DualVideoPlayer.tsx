"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { PoseLandmarker } from "@/lib/mediapipe";
import { interpolatePoseAt } from "@/lib/interpolatePose";
import type { PoseFrame, PosePersonFrame } from "@/lib/types";
import type { TimeRange } from "@/lib/compare/types";

const PERSON_COLORS = ["#a78bfa", "#f472b6", "#38bdf8", "#facc15", "#4ade80", "#fb923c"];

function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function drawPerson(ctx: CanvasRenderingContext2D, person: PosePersonFrame, width: number, height: number) {
  const color = PERSON_COLORS[person.id % PERSON_COLORS.length];
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, width / 300);

  for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
    const a = person.landmarks[start];
    const b = person.landmarks[end];
    if (!a || !b || a.visibility < 0.3 || b.visibility < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }

  const dotRadius = Math.max(2, width / 250);
  for (const lm of person.landmarks) {
    if (lm.visibility < 0.3) continue;
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface DualVideoPlayerHandle {
  seekUserTime: (t: number) => void;
}

interface PaneProps {
  videoUrl: string;
  poseData: PoseFrame[];
  mirrored?: boolean;
}

const Pane = forwardRef<HTMLVideoElement, PaneProps>(function Pane(
  { videoUrl, poseData, mirrored },
  videoRef,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const video = (videoRef as React.RefObject<HTMLVideoElement>).current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    function syncSize() {
      if (!video || !canvas) return;
      if (video.videoWidth && canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    }

    function draw() {
      if (!video || !canvas) return;
      syncSize();
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const persons = interpolatePoseAt(poseData, video.currentTime);
        persons.forEach((p) => drawPerson(ctx, p, canvas.width, canvas.height));
      }
      rafRef.current = requestAnimationFrame(draw);
    }

    video.addEventListener("loadedmetadata", syncSize);
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      video.removeEventListener("loadedmetadata", syncSize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseData]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-border bg-black"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    >
      <video ref={videoRef} src={videoUrl} playsInline muted className="block w-full" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
});

interface Props {
  userVideoUrl: string;
  userPoseData: PoseFrame[];
  userDurationSec: number;
  userLabel: string;
  refVideoUrl: string;
  refPoseData: PoseFrame[];
  refDurationSec: number;
  refLabel: string;
  mirrored: boolean;
  /** 지정하면 전체 영상 대신 이 구간만 재생/반복한다 (구간 지정 비교 미리듣기용). */
  userRange?: TimeRange;
  refRange?: TimeRange;
  loop?: boolean;
}

export const DualVideoPlayer = forwardRef<DualVideoPlayerHandle, Props>(function DualVideoPlayer(
  {
    userVideoUrl,
    userPoseData,
    userDurationSec,
    userLabel,
    refVideoUrl,
    refPoseData,
    refDurationSec,
    refLabel,
    mirrored,
    userRange,
    refRange,
    loop = false,
  },
  handleRef,
) {
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const refVideoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0~1, 사용자 구간(또는 전체) 기준

  const uStart = userRange?.start ?? 0;
  const uEnd = userRange?.end ?? userDurationSec;
  const uLen = Math.max(0.01, uEnd - uStart);
  const rStart = refRange?.start ?? 0;
  const rEnd = refRange?.end ?? refDurationSec;
  const rLen = Math.max(0.01, rEnd - rStart);

  useImperativeHandle(handleRef, () => ({
    seekUserTime: (t: number) => {
      const fraction = Math.max(0, Math.min(1, (t - uStart) / uLen));
      applyFraction(fraction);
    },
  }));

  function applyFraction(fraction: number) {
    const uv = userVideoRef.current;
    const rv = refVideoRef.current;
    if (uv) uv.currentTime = uStart + fraction * uLen;
    if (rv) rv.currentTime = rStart + fraction * rLen;
    setProgress(fraction);
  }

  // 구간이 바뀌면(다른 쌍 미리듣기로 전환) 그 구간 시작점으로 이동
  useEffect(() => {
    applyFraction(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uStart, uEnd, rStart, rEnd]);

  useEffect(() => {
    const uv = userVideoRef.current;
    if (!uv) return;
    function onTimeUpdate() {
      if (!uv) return;
      if (uv.currentTime >= uEnd) {
        if (loop) {
          applyFraction(0);
          if (!uv.paused) uv.play();
        } else {
          uv.pause();
        }
        return;
      }
      const fraction = Math.max(0, Math.min(1, (uv.currentTime - uStart) / uLen));
      setProgress(fraction);
      // 재생 중 두 영상이 벌어지면(디코딩 속도 차이 등) 살짝 보정
      const rv = refVideoRef.current;
      if (rv) {
        const expectedRefTime = rStart + fraction * rLen;
        if (Math.abs(rv.currentTime - expectedRefTime) > 0.3) {
          rv.currentTime = expectedRefTime;
        }
      }
    }
    function onPlay() {
      setPlaying(true);
      refVideoRef.current?.play().catch(() => {});
    }
    function onPause() {
      setPlaying(false);
      refVideoRef.current?.pause();
    }
    uv.addEventListener("timeupdate", onTimeUpdate);
    uv.addEventListener("play", onPlay);
    uv.addEventListener("pause", onPause);
    return () => {
      uv.removeEventListener("timeupdate", onTimeUpdate);
      uv.removeEventListener("play", onPlay);
      uv.removeEventListener("pause", onPause);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uStart, uEnd, uLen, rStart, rLen, loop]);

  function togglePlay() {
    const uv = userVideoRef.current;
    if (!uv) return;
    if (uv.currentTime >= uEnd || uv.currentTime < uStart) applyFraction(0);
    if (uv.paused) uv.play();
    else uv.pause();
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    applyFraction(Number(e.target.value));
  }

  const userTime = uStart + progress * uLen;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="mb-1 text-xs text-muted">{userLabel}</p>
        <Pane ref={userVideoRef} videoUrl={userVideoUrl} poseData={userPoseData} />
      </div>
      <div>
        <p className="mb-1 text-xs text-muted">
          {refLabel} {mirrored && <span className="text-accent-light">(거울모드로 매칭됨)</span>}
        </p>
        <Pane ref={refVideoRef} videoUrl={refVideoUrl} poseData={refPoseData} mirrored={mirrored} />
      </div>

      <div className="mt-1 flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white"
          aria-label={playing ? "일시정지" : "재생"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={handleScrub}
          className="h-1 flex-1 accent-accent"
        />
        <span className="w-20 shrink-0 text-right text-xs text-muted">
          {formatTime(userTime)} / {formatTime(userRange ? uEnd : userDurationSec)}
        </span>
      </div>
    </div>
  );
});
