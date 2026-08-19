import { createIndependentPoseLandmarker } from "./mediapipe";
import {
  driveFrameGrid,
  ensureFiniteDuration,
  seekTo,
  toPosePersonFrames,
  SAMPLE_FPS,
  SAMPLE_STEP_SEC,
  EXTRACTION_PLAYBACK_RATE,
  type RVFCVideo,
} from "./poseExtraction";
import type { PoseFrame } from "./types";

/** Pro 전용: 영상을 실제로 자르지 않고, 같은 blob URL을 가리키는 video 엘리먼트 여러 개를
 *  서로 다른 시간 구간으로 동시에 재생시켜서 병렬로 포즈를 뽑는다. 각 구간은 완전히 독립된
 *  MediaPipe 인스턴스를 쓰므로(싱글턴 공유 안 함) 서로 타임스탬프가 간섭하지 않는다. */
const CHUNK_COUNT = 5;

function alignToGrid(t: number): number {
  return Math.ceil(t / SAMPLE_STEP_SEC) * SAMPLE_STEP_SEC;
}

async function loadVideo(url: string): Promise<RVFCVideo> {
  const video = document.createElement("video") as RVFCVideo;
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("영상을 불러오지 못했어요.")), {
      once: true,
    });
  });
  return video;
}

async function extractChunk(
  videoUrl: string,
  start: number,
  end: number,
  onProgress: (done: number) => void,
): Promise<PoseFrame[]> {
  const video = await loadVideo(videoUrl);
  const landmarker = await createIndependentPoseLandmarker();
  const frames: PoseFrame[] = [];

  try {
    await seekTo(video, start);

    await new Promise<void>((resolve, reject) => {
      let stopped = false;

      function stop() {
        if (stopped) return;
        stopped = true;
        handle.stop();
        video.pause();
        video.playbackRate = 1;
        video.removeEventListener("error", onError);
        resolve();
      }

      function onError() {
        if (stopped) return;
        stopped = true;
        handle.stop();
        reject(new Error("영상 재생 중 오류가 발생했어요."));
      }

      const handle = driveFrameGrid(
        video,
        SAMPLE_STEP_SEC,
        (t) => {
          if (stopped) return;
          if (t > end) {
            stop();
            return;
          }
          const result = landmarker.detectForVideo(video, Math.round(t * 1000));
          frames.push({ timestamp: t, persons: toPosePersonFrames(result.landmarks) });
          onProgress(frames.length);
        },
        alignToGrid(start),
      );

      video.addEventListener("ended", stop, { once: true });
      video.addEventListener("error", onError, { once: true });
      video.playbackRate = EXTRACTION_PLAYBACK_RATE;
      video.play().catch(onError);
    });
  } finally {
    landmarker.close();
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  return frames;
}

export async function extractPosesFromVideoParallel(
  file: File,
  onProgress: (done: number, total: number) => void,
): Promise<PoseFrame[]> {
  const probeUrl = URL.createObjectURL(file);
  let duration: number;
  try {
    const probeVideo = await loadVideo(probeUrl);
    duration = await ensureFiniteDuration(probeVideo);
  } finally {
    URL.revokeObjectURL(probeUrl);
  }
  if (duration <= 0) {
    throw new Error("영상 길이를 읽지 못했어요. 다른 파일로 시도해주세요.");
  }

  const videoUrl = URL.createObjectURL(file);
  const chunkLen = duration / CHUNK_COUNT;
  const estimatedTotal = Math.max(1, Math.ceil(duration * SAMPLE_FPS));
  const doneCounts = new Array(CHUNK_COUNT).fill(0);

  function reportProgress() {
    onProgress(
      doneCounts.reduce((a, b) => a + b, 0),
      estimatedTotal,
    );
  }

  try {
    const chunkResults = await Promise.all(
      Array.from({ length: CHUNK_COUNT }, (_, i) => {
        const start = i * chunkLen;
        const end = i === CHUNK_COUNT - 1 ? duration : (i + 1) * chunkLen;
        return extractChunk(videoUrl, start, end, (done) => {
          doneCounts[i] = done;
          reportProgress();
        });
      }),
    );
    return chunkResults.flat().sort((a, b) => a.timestamp - b.timestamp);
  } finally {
    URL.revokeObjectURL(videoUrl);
  }
}
