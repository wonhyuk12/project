"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScoreGauge } from "@/components/compare/ScoreGauge";
import { useProjectStore } from "@/lib/store";
import { useCompareStore } from "@/lib/compare/store";
import { compareLiveFrame, compareSequences } from "@/lib/compare/pose-compare";
import { interpolatePoseAt } from "@/lib/interpolatePose";
import { getPoseLandmarker } from "@/lib/mediapipe";
import {
  driveFrameGrid,
  reserveTimestampSession,
  toGraphTimestampMs,
  toPosePersonFrames,
  SAMPLE_FPS,
  type RVFCVideo,
} from "@/lib/poseExtraction";
import { phraseForJoint, praisePhrase } from "@/lib/live/livePhrases";
import { extensionFromFile } from "@/lib/videoFile";
import type { PoseFrame, Version } from "@/lib/types";
import type { WorstJoint } from "@/lib/compare/types";

const SAMPLE_STEP_SEC = 1 / SAMPLE_FPS;
const SCORE_WINDOW = 10; // 최근 1초(10프레임) 이동평균
const PRAISE_SCORE_THRESHOLD = 90;

type Status =
  | "idle"
  | "requesting-camera"
  | "loading-model"
  | "ready"
  | "running"
  | "finishing"
  | "done"
  | "unsupported"
  | "error";

function isRVFCSupported(): boolean {
  return typeof window !== "undefined" && "requestVideoFrameCallback" in HTMLVideoElement.prototype;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}

export function LivePracticeSession({
  projectId,
  referenceVersion,
}: {
  projectId: string;
  referenceVersion: Version;
}) {
  const router = useRouter();
  const addVersion = useProjectStore((s) => s.addVersion);
  const addRun = useCompareStore((s) => s.addRun);

  const refVideoRef = useRef<HTMLVideoElement>(null);
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const liveFramesRef = useRef<PoseFrame[]>([]);
  const scoreWindowRef = useRef<number[]>([]);
  const gridHandleRef = useRef<{ stop: () => void } | null>(null);
  const lastPhraseAtRef = useRef(0);
  const landmarkerCacheRef = useRef<Awaited<ReturnType<typeof getPoseLandmarker>> | null>(null);
  const mirroredRef = useRef(true);
  const finishedRef = useRef(false);

  const [status, setStatus] = useState<Status>(() =>
    isRVFCSupported() ? "idle" : "unsupported",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(true);
  const [liveScore, setLiveScore] = useState(0);
  const [phrase, setPhrase] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      gridHandleRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera() {
    setErrorMessage(null);
    setStatus("requesting-camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      const cam = camVideoRef.current;
      if (cam) {
        cam.srcObject = stream;
        await cam.play();
      }

      setStatus("loading-model");
      await getPoseLandmarker();

      setStatus("ready");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? `카메라를 켜지 못했어요: ${err.message}`
          : "카메라를 켜지 못했어요.",
      );
    }
  }

  function pushScore(score: number) {
    const win = scoreWindowRef.current;
    win.push(score);
    if (win.length > SCORE_WINDOW) win.shift();
    const avg = win.reduce((a, b) => a + b, 0) / win.length;
    setLiveScore(Math.round(avg * 10) / 10);
  }

  function updatePhrase(worstJoint: WorstJoint | null, avgScore: number) {
    const now = performance.now();
    if (now - lastPhraseAtRef.current < 1200) return;
    lastPhraseAtRef.current = now;
    if (avgScore >= PRAISE_SCORE_THRESHOLD || !worstJoint) {
      setPhrase(praisePhrase(now));
    } else {
      setPhrase(phraseForJoint(worstJoint.joint));
    }
  }

  function onTick(t: number, sessionOffsetMs: number) {
    const landmarker = landmarkerCacheRef.current;
    const cam = camVideoRef.current;
    if (!landmarker || !cam) return;

    const result = landmarker.detectForVideo(cam, toGraphTimestampMs(sessionOffsetMs, t));
    const persons = toPosePersonFrames(result.landmarks);
    liveFramesRef.current.push({ timestamp: t, persons });

    const userLandmarks = persons[0]?.landmarks ?? null;
    const refPersons = interpolatePoseAt(referenceVersion.poseData, t);
    const refLandmarks = refPersons[0]?.landmarks ?? null;

    const evalResult = compareLiveFrame(userLandmarks, refLandmarks, mirroredRef.current);
    if (evalResult) {
      pushScore(evalResult.score);
      updatePhrase(evalResult.worstJoint, evalResult.score);
    }

    if (referenceVersion.durationSec > 0) {
      setProgress(Math.min(100, (t / referenceVersion.durationSec) * 100));
    }
  }

  mirroredRef.current = mirrored;

  async function startSession() {
    const refVideo = refVideoRef.current;
    const cam = camVideoRef.current;
    if (!refVideo || !cam || !streamRef.current) return;

    setErrorMessage(null);
    liveFramesRef.current = [];
    scoreWindowRef.current = [];
    finishedRef.current = false;
    setLiveScore(0);
    setProgress(0);
    setPhrase("");

    try {
      landmarkerCacheRef.current = await getPoseLandmarker();

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        streamRef.current,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start();

      const sessionOffsetMs = reserveTimestampSession(referenceVersion.durationSec);

      refVideo.currentTime = 0;
      await refVideo.play();

      setStatus("running");

      gridHandleRef.current = driveFrameGrid(refVideo as RVFCVideo, SAMPLE_STEP_SEC, (t) =>
        onTick(t, sessionOffsetMs),
      );

      refVideo.addEventListener("ended", () => finishSession(), { once: true });
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "세션을 시작하지 못했어요.");
    }
  }

  async function finishSession() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setStatus("finishing");
    gridHandleRef.current?.stop();
    gridHandleRef.current = null;

    const refVideo = refVideoRef.current;
    refVideo?.pause();

    const recorder = recorderRef.current;
    const recordedBlob = await new Promise<Blob | null>((resolve) => {
      if (!recorder || recorder.state === "inactive") {
        resolve(chunksRef.current.length > 0 ? new Blob(chunksRef.current) : null);
        return;
      }
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      recorder.stop();
    });

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const livePoseData = liveFramesRef.current;
    if (livePoseData.length === 0 || !recordedBlob) {
      setStatus("error");
      setErrorMessage("녹화된 내용이 없어요. 다시 시도해주세요.");
      return;
    }

    const probeUrl = URL.createObjectURL(recordedBlob);
    const durationSec = await readVideoDuration(probeUrl, referenceVersion.durationSec);
    URL.revokeObjectURL(probeUrl);

    const now = new Date();
    const label = `실시간 연습 · ${now.toISOString().slice(5, 10)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    let version;
    try {
      version = await addVersion({
        projectId,
        label,
        videoBlob: recordedBlob,
        videoExt: extensionFromFile(recordedBlob),
        durationSec,
        poseData: livePoseData,
      });
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "녹화 저장에 실패했어요.");
      return;
    }

    try {
      const score = compareSequences(livePoseData, referenceVersion.poseData);
      const run = await addRun({
        projectId,
        userVersionId: version.id,
        source: {
          type: "archive",
          versionId: referenceVersion.id,
          projectId: referenceVersion.projectId,
        },
        result: { ...score, referenceKind: "archive" },
      });
      setStatus("done");
      router.push(`/projects/${projectId}/compare/${run.id}`);
    } catch (err) {
      console.error(err);
      // 채점이 실패해도 녹화 자체는 이미 버전으로 저장됐으니 그 화면으로라도 보낸다.
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "채점에 실패했어요 — 녹화는 버전으로 저장됐어요.",
      );
      router.push(`/projects/${projectId}/versions/${version.id}`);
    }
  }

  function stopEarly() {
    refVideoRef.current?.pause();
    finishSession();
  }

  if (status === "unsupported") {
    return (
      <p className="mx-4 mt-10 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-center text-sm text-red-300">
        이 브라우저는 실시간 연습 기능을 지원하지 않아요. 최신 Chrome/Edge에서 시도해주세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-8">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
        <video ref={refVideoRef} src={referenceVersion.videoUrl} playsInline className="h-full w-full object-contain" />
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          레퍼런스 · {referenceVersion.label}
        </span>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
        <video
          ref={camVideoRef}
          muted
          playsInline
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          내 웹캠
        </span>
        {status === "running" && (
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between rounded-lg bg-black/60 px-2 py-1">
            <span className="text-xs font-medium text-white">{liveScore}%</span>
            {phrase && <span className="text-xs text-accent-light">{phrase}</span>}
          </div>
        )}
      </div>

      {status === "running" && (
        <div className="flex flex-col items-center gap-2">
          <ScoreGauge score={liveScore} />
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {errorMessage && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
          {errorMessage}
        </p>
      )}

      {status === "idle" && (
        <button
          onClick={startCamera}
          className="rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light"
        >
          📷 카메라 켜기
        </button>
      )}

      {(status === "requesting-camera" || status === "loading-model") && (
        <p className="text-center text-xs text-muted">
          {status === "requesting-camera" ? "카메라 권한을 요청하는 중…" : "포즈 인식 모델을 불러오는 중…"}
        </p>
      )}

      {status === "ready" && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={mirrored}
              onChange={(e) => setMirrored(e.target.checked)}
              className="accent-accent"
            />
            좌우 반전(거울모드) — 보통 이걸 켜고 따라 추면 자연스러워요
          </label>
          <button
            onClick={startSession}
            className="rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-light"
          >
            ▶ 시작 (노래가 재생돼요)
          </button>
        </div>
      )}

      {status === "running" && (
        <button
          onClick={stopEarly}
          className="rounded-xl border border-border bg-surface py-3 text-sm text-muted transition-colors hover:bg-surface-hover"
        >
          ⏹ 종료하고 결과 보기
        </button>
      )}

      {status === "finishing" && (
        <p className="text-center text-xs text-muted">결과를 계산하는 중…</p>
      )}
    </div>
  );
}

function readVideoDuration(videoUrl: string, fallbackSec: number): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = videoUrl;
    v.onloadedmetadata = () => {
      resolve(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : fallbackSec);
    };
    v.onerror = () => resolve(fallbackSec);
  });
}
