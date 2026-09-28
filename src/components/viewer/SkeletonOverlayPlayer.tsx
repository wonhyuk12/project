"use client";

import { useEffect, useRef, useState } from "react";
import { PoseLandmarker } from "@/lib/mediapipe";
import { interpolatePoseAt } from "@/lib/interpolatePose";
import type { PosePersonFrame, Version } from "@/lib/types";

const PERSON_COLORS = [
  "#a78bfa",
  "#f472b6",
  "#38bdf8",
  "#facc15",
  "#4ade80",
  "#fb923c",
  "#f87171",
  "#c084fc",
];

function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function drawPerson(
  ctx: CanvasRenderingContext2D,
  person: PosePersonFrame,
  width: number,
  height: number,
) {
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

export function SkeletonOverlayPlayer({ version }: { version: Version }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    function syncCanvasSize() {
      if (!video || !canvas) return;
      if (video.videoWidth && canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    }

    function draw() {
      if (!video || !canvas) return;
      syncCanvasSize();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (showSkeleton) {
        const persons = interpolatePoseAt(version.poseData, video.currentTime);
        persons.forEach((p) => drawPerson(ctx, p, canvas.width, canvas.height));
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    video.addEventListener("loadedmetadata", syncCanvasSize);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      video.removeEventListener("loadedmetadata", syncCanvasSize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [version.poseData, showSkeleton]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
  }

  return (
    <div>
      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black">
        <video ref={videoRef} src={version.videoUrl} playsInline className="block w-full" />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
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
          max={version.durationSec || 0}
          step={0.1}
          value={currentTime}
          onChange={handleScrub}
          className="h-1 flex-1 accent-accent"
        />
        <span className="w-16 shrink-0 text-right text-xs text-muted">
          {formatTime(currentTime)} / {formatTime(version.durationSec)}
        </span>
      </div>

      <label className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <input
          type="checkbox"
          checked={showSkeleton}
          onChange={(e) => setShowSkeleton(e.target.checked)}
          className="accent-accent"
        />
        스켈레톤 오버레이 표시
      </label>
    </div>
  );
}
