"use client";

import { useEffect, useRef, useState } from "react";
import { getPoseLandmarker, LOAD_TIMEOUT_SEC, type LoadStage } from "@/lib/mediapipe";
import { extractPosesFromVideo, SAMPLE_FPS } from "@/lib/poseExtraction";
import { extractPosesFromVideoParallel } from "@/lib/poseExtractionParallel";
import { usePlanStore } from "@/lib/plan/store";
import type { PoseFrame } from "@/lib/types";

type Status = "idle" | "ready" | "loading-model" | "extracting" | "done" | "error";

export interface ExtractionResult {
  file: File;
  videoUrl: string;
  durationSec: number;
  poseData: PoseFrame[];
}

interface Props {
  onExtracted: (result: ExtractionResult) => void;
  onFileChange?: (file: File | null) => void;
}

export function PoseExtractor({ onExtracted, onFileChange }: Props) {
  const plan = usePlanStore((s) => s.plan);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState(LOAD_TIMEOUT_SEC);
  const [loadStage, setLoadStage] = useState<LoadStage>("wasm");

  useEffect(() => {
    if (status !== "loading-model") return;
    const interval = setInterval(() => {
      setRemainingSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setResultSummary(null);
    setErrorMessage(null);
    if (!picked) {
      setFile(null);
      setVideoUrl(null);
      setStatus("idle");
      onFileChange?.(null);
      return;
    }
    setFile(picked);
    setVideoUrl(URL.createObjectURL(picked));
    setStatus("ready");
    onFileChange?.(picked);
  }

  async function startExtraction() {
    const video = videoRef.current;
    if (!video || !file) return;

    setStatus("loading-model");
    setErrorMessage(null);
    setProgress({ done: 0, total: 0 });
    setRemainingSec(LOAD_TIMEOUT_SEC);
    setLoadStage("wasm");

    try {
      let poseData: PoseFrame[];

      if (plan === "pro") {
        setStatus("extracting");
        poseData = await extractPosesFromVideoParallel(file, (done, total) =>
          setProgress({ done, total }),
        );
      } else {
        const landmarker = await getPoseLandmarker(setLoadStage);

        if (video.readyState < 1) {
          await new Promise<void>((resolve) => {
            video.addEventListener("loadedmetadata", () => resolve(), { once: true });
          });
        }

        setStatus("extracting");
        poseData = await extractPosesFromVideo(video, landmarker, (done, total) =>
          setProgress({ done, total }),
        );
      }

      const detectedPersons = Math.max(0, ...poseData.map((f) => f.persons.length));
      setResultSummary(
        `추출 완료 · ${poseData.length}프레임 (초당 ${SAMPLE_FPS}프레임) · 최대 ${detectedPersons}명 감지${
          plan === "pro" ? " · ⚡ Pro 고속 처리" : ""
        }`,
      );
      setStatus("done");
      onExtracted({ file, videoUrl: videoUrl!, durationSec: video.duration, poseData });
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "포즈 인식 모델을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.",
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface px-3 py-6 text-center transition-colors hover:bg-surface-hover"
      >
        <span className="text-2xl">🎬</span>
        <span className="text-sm text-foreground">
          {file ? file.name : "MP4 / MOV 파일을 선택하세요"}
        </span>
        <span className="text-[11px] text-muted-2">
          아직 서버 저장은 안 돼요 — 새로고침하면 사라져요 (Phase 6에서 연결)
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        className="hidden"
        onChange={handleFileChange}
      />

      {videoUrl && (
        <div className="relative mt-3">
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            playsInline
            preload="metadata"
            className="w-full rounded-xl border border-border"
          />
          {status === "extracting" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 px-3 text-center">
              <p className="text-xs text-zinc-200">
                {plan === "pro"
                  ? "⚡ Pro 고속 처리 중이에요 — 5배 더 빠르게 분석하고 있어요"
                  : "정확도를 위해 0.3배속으로 분석하고 있어요(시간이 원래의 3배 정도 걸려요) — 실제 저장되는 영상은 원래 속도 그대로예요"}
              </p>
            </div>
          )}
        </div>
      )}

      {status === "ready" && (
        <button
          type="button"
          onClick={startExtraction}
          className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-light"
        >
          포즈 추출 시작
        </button>
      )}

      {status === "loading-model" && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div className="h-full w-1/3 animate-pulse bg-accent" />
          </div>
          <p className="mt-1.5 text-center text-xs text-muted">
            {loadStage === "wasm" ? "인식 엔진(WASM) 불러오는 중…" : "포즈 모델 파일 다운로드 중…"}{" "}
            최초 1회만 다운로드해요, 최대 1분 정도 걸릴 수 있어요 (남은 시간 약{" "}
            {remainingSec}초)
          </p>
          <p className="mt-1 text-center text-[11px] text-muted-2">
            너무 오래 걸리면 브라우저 개발자도구(F12) → Console 탭을 열어 [mediapipe]로
            시작하는 로그가 어디서 멈췄는지 확인해주세요
          </p>
        </div>
      )}

      {status === "extracting" && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-accent transition-all"
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-center text-xs text-muted">
            포즈 추출 중… {progress.done}/{progress.total || "?"}
          </p>
        </div>
      )}

      {status === "done" && resultSummary && (
        <p className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-center text-xs text-accent-light">
          {resultSummary}
        </p>
      )}

      {status === "error" && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-center">
          <p className="text-xs text-red-300">{errorMessage}</p>
          <button
            type="button"
            onClick={startExtraction}
            className="mt-2 rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-200 transition-colors hover:bg-red-500/10"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
