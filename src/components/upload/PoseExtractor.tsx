"use client";

import { useEffect, useRef, useState } from "react";
import { LOAD_TIMEOUT_SEC, type LoadStage } from "@/lib/mediapipe";
import { SAMPLE_FPS, ensureFiniteDuration } from "@/lib/poseExtraction";
import { extractPosesFromVideoParallel } from "@/lib/poseExtractionParallel";
import type { PoseFrame } from "@/lib/types";

type Status = "idle" | "ready" | "loading-model" | "extracting" | "done" | "error";
type CameraStatus = "off" | "requesting" | "live" | "recording";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}

function formatSec(s: number): string {
  const total = Math.max(0, Math.round(s));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const camPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const songInputRef = useRef<HTMLInputElement>(null);
  const songAudioRef = useRef<HTMLAudioElement>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("off");
  const [songUrl, setSongUrl] = useState<string | null>(null);
  const [songDuration, setSongDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [songPlaying, setSongPlaying] = useState(false);
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

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (songUrl) URL.revokeObjectURL(songUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    setErrorMessage(null);
    setCameraStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      const preview = camPreviewRef.current;
      if (preview) {
        preview.srcObject = stream;
        await preview.play();
      }
      setCameraStatus("live");
    } catch (err) {
      setCameraStatus("off");
      setErrorMessage(
        err instanceof Error ? `카메라를 켜지 못했어요: ${err.message}` : "카메라를 켜지 못했어요.",
      );
    }
  }

  function cancelCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    songAudioRef.current?.pause();
    setSongPlaying(false);
    setCameraStatus("off");
  }

  function handleSongChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (songUrl) URL.revokeObjectURL(songUrl);
    if (!picked) {
      setSongUrl(null);
      setSongDuration(0);
      setTrimStart(0);
      setTrimEnd(0);
      return;
    }
    setSongUrl(URL.createObjectURL(picked));
    setSongPlaying(false);
  }

  function handleSongLoadedMetadata() {
    const audio = songAudioRef.current;
    if (!audio) return;
    const d = Number.isFinite(audio.duration) ? audio.duration : 0;
    setSongDuration(d);
    setTrimStart(0);
    setTrimEnd(d);
  }

  function handleSongTimeUpdate() {
    const audio = songAudioRef.current;
    if (!audio || !songPlaying) return;
    if (audio.currentTime >= trimEnd) {
      audio.pause();
      setSongPlaying(false);
    }
  }

  function updateTrimStart(v: number) {
    setTrimStart(Math.min(v, trimEnd - 0.5 > 0 ? trimEnd - 0.5 : 0));
  }

  function updateTrimEnd(v: number) {
    setTrimEnd(Math.max(v, trimStart + 0.5 < songDuration ? trimStart + 0.5 : songDuration));
  }

  function toggleSongPreview() {
    const audio = songAudioRef.current;
    if (!audio) return;
    if (songPlaying) {
      audio.pause();
      setSongPlaying(false);
      return;
    }
    audio.currentTime = trimStart;
    audio.play();
    setSongPlaying(true);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraStatus("off");

      const recorded = new File([blob], `camera-${Date.now()}.webm`, {
        type: blob.type || "video/webm",
      });
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setResultSummary(null);
      setErrorMessage(null);
      setFile(recorded);
      setVideoUrl(URL.createObjectURL(recorded));
      setStatus("ready");
      onFileChange?.(recorded);
    };
    recorderRef.current = recorder;
    recorder.start();
    setCameraStatus("recording");

    const song = songAudioRef.current;
    if (song && songUrl) {
      song.currentTime = trimStart;
      song.play();
      setSongPlaying(true);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    songAudioRef.current?.pause();
    setSongPlaying(false);
  }

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
      setStatus("extracting");
      const poseData = await extractPosesFromVideoParallel(file, (done, total) =>
        setProgress({ done, total }),
      );

      const detectedPersons = Math.max(0, ...poseData.map((f) => f.persons.length));
      setResultSummary(
        `추출 완료 · ${poseData.length}프레임 (초당 ${SAMPLE_FPS}프레임) · 최대 ${detectedPersons}명 감지`,
      );
      setStatus("done");
      // 카메라로 촬영한 webm은 MediaRecorder 특성상 duration이 Infinity로 나오는 경우가
      // 있어서(크로미움 알려진 이슈), 그대로 보내면 DB duration_sec NOT NULL 제약에 걸려
      // 프로젝트/버전 저장이 실패한다 — 나머지 추출 파이프라인처럼 seek 우회로 강제 계산한다.
      const durationSec = await ensureFiniteDuration(video);
      onExtracted({ file, videoUrl: videoUrl!, durationSec, poseData });
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
      {cameraStatus === "off" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface px-3 py-6 text-center transition-colors hover:bg-surface-hover"
          >
            <span className="text-2xl">🎬</span>
            <span className="text-sm text-foreground">
              {file ? file.name : "MP4 / MOV 파일을 선택하세요"}
            </span>
          </button>
          <button
            type="button"
            onClick={startCamera}
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface px-3 py-6 text-center transition-colors hover:bg-surface-hover"
          >
            <span className="text-2xl">📷</span>
            <span className="text-sm text-foreground">카메라로 촬영</span>
          </button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        className="hidden"
        onChange={handleFileChange}
      />

      {cameraStatus !== "off" && (
        <div className="relative mt-3">
          <video
            ref={camPreviewRef}
            muted
            playsInline
            className="w-full rounded-xl border border-border bg-black"
            style={{ transform: "scaleX(-1)" }}
          />
          {cameraStatus === "recording" && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> 촬영 중
            </span>
          )}
          <div className="mt-3 flex gap-2">
            {cameraStatus === "requesting" && (
              <p className="flex-1 text-center text-xs text-muted">카메라 권한을 요청하는 중…</p>
            )}
            {cameraStatus === "live" && (
              <>
                <button
                  type="button"
                  onClick={cancelCamera}
                  className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-muted transition-colors hover:bg-surface-hover"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-light"
                >
                  ⏺ 촬영 시작
                </button>
              </>
            )}
            {cameraStatus === "recording" && (
              <button
                type="button"
                onClick={stopRecording}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-light"
              >
                ⏹ 촬영 종료
              </button>
            )}
          </div>

          {cameraStatus !== "requesting" && (
            <div className="mt-3 rounded-xl border border-border bg-surface p-3">
              <input
                ref={songInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleSongChange}
              />
              {!songUrl ? (
                <button
                  type="button"
                  onClick={() => songInputRef.current?.click()}
                  disabled={cameraStatus === "recording"}
                  className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-muted transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  🎵 노래 업로드 (선택 · 촬영 중 재생돼요)
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>
                      🎵 재생 구간 {formatSec(trimStart)} ~ {formatSec(trimEnd)}
                    </span>
                    <button
                      type="button"
                      onClick={toggleSongPreview}
                      disabled={cameraStatus === "recording"}
                      className="text-accent-light underline disabled:opacity-40"
                    >
                      {songPlaying ? "정지" : "미리듣기"}
                    </button>
                  </div>
                  <label className="flex flex-col gap-1 text-[11px] text-muted-2">
                    시작 {formatSec(trimStart)}
                    <input
                      type="range"
                      min={0}
                      max={songDuration}
                      step={0.1}
                      value={trimStart}
                      disabled={cameraStatus === "recording"}
                      onChange={(e) => updateTrimStart(Number(e.target.value))}
                      className="accent-accent"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-muted-2">
                    끝 {formatSec(trimEnd)}
                    <input
                      type="range"
                      min={0}
                      max={songDuration}
                      step={0.1}
                      value={trimEnd}
                      disabled={cameraStatus === "recording"}
                      onChange={(e) => updateTrimEnd(Number(e.target.value))}
                      className="accent-accent"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => songInputRef.current?.click()}
                    disabled={cameraStatus === "recording"}
                    className="text-left text-[11px] text-muted-2 underline disabled:opacity-40"
                  >
                    다른 노래로 바꾸기
                  </button>
                </div>
              )}
              <audio
                ref={songAudioRef}
                src={songUrl ?? undefined}
                onLoadedMetadata={handleSongLoadedMetadata}
                onTimeUpdate={handleSongTimeUpdate}
                onEnded={() => setSongPlaying(false)}
                className="hidden"
              />
            </div>
          )}
        </div>
      )}

      {cameraStatus === "off" && videoUrl && (
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
              <p className="text-xs text-zinc-200">빠르게 분석하고 있어요</p>
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
