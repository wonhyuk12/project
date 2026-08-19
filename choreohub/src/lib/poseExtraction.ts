import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseFrame, PosePersonFrame } from "./types";

export const SAMPLE_FPS = 10;
export const SAMPLE_STEP_SEC = 1 / SAMPLE_FPS;
// 1배속으로 재생하면 프레임 추론(detectForVideo)이 디코딩을 못 따라가서 프레임을 건너뛰고,
// 그때마다 실제로 샘플되는 순간이 흔들려서 같은 영상을 두 번 추출해도 결과가 달라진다.
// 재생을 늦추면 디코딩이 추론 속도를 여유 있게 앞서가서 프레임을 거의 안 건너뛰게 된다.
export const EXTRACTION_PLAYBACK_RATE = 0.3;

// `requestVideoFrameCallback` isn't in every TS DOM lib version yet.
export interface VideoFrameCallbackMetadata {
  mediaTime: number;
}
export type RVFCVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: VideoFrameCallbackMetadata) => void,
  ) => number;
};

/**
 * The PoseLandmarker instance is a singleton (see lib/mediapipe.ts) reused across every
 * extraction call for speed, but its underlying graph is stateful and requires
 * timestamps to keep increasing for the *lifetime of the landmarker*, not just within
 * one video. Without this, extracting a second video (which naturally starts back at
 * ~0ms) after a first one crashes with "Packet timestamp mismatch". Each extraction
 * (or live) session reserves a block of timestamp-space starting after the previous one.
 */
let nextTimestampOffsetMs = 0;

/** Reserves a block of graph-timestamp space for a new session (batch extraction or a
 *  live webcam session) so it never collides with a previous session's timestamps. */
export function reserveTimestampSession(estimatedDurationSec: number): number {
  const sessionOffsetMs = nextTimestampOffsetMs;
  nextTimestampOffsetMs = sessionOffsetMs + Math.round(Math.max(0, estimatedDurationSec) * 1000) + 1000;
  return sessionOffsetMs;
}

export function toGraphTimestampMs(sessionOffsetMs: number, localSec: number): number {
  return sessionOffsetMs + Math.round(localSec * 1000);
}

/**
 * Drives `onTick` at a fixed absolute grid (0, stepSec, 2*stepSec, ...) of `video`'s own
 * media time via requestVideoFrameCallback, same anti-drift pattern as extractViaPlayback
 * (see its comment). Used by the live practice loop, where `video` is the *reference*
 * video (the shared clock) while pose detection itself runs on a separate webcam video.
 */
export function driveFrameGrid(
  video: RVFCVideo,
  stepSec: number,
  onTick: (t: number) => void,
  initialGridTime = 0,
): { stop: () => void } {
  let nextGridTime = initialGridTime;
  let stopped = false;

  function onFrame(_now: number, metadata: VideoFrameCallbackMetadata) {
    if (stopped) return;
    const t = metadata.mediaTime;
    if (t >= nextGridTime - 0.005) {
      while (nextGridTime <= t) nextGridTime += stepSec;
      onTick(t);
    }
    if (!stopped) video.requestVideoFrameCallback!(onFrame);
  }

  video.requestVideoFrameCallback!(onFrame);
  return {
    stop: () => {
      stopped = true;
    },
  };
}

export function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.008) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    }, 1000);
    function onSeeked() {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    }
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}

/**
 * Some browsers report `video.duration === Infinity` for certain mp4/mov containers
 * (missing duration in the moov atom) until a seek forces the real value to be
 * computed. Without this, sampling loops keyed off `duration` would never end.
 */
export async function ensureFiniteDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  console.warn(
    `[pose] video.duration is ${video.duration}, forcing recalculation via seek workaround`,
  );
  await seekTo(video, 1e7);
  await seekTo(video, 0);
  return Number.isFinite(video.duration) ? video.duration : 0;
}

export function toPosePersonFrames(landmarksList: NormalizedLandmark[][]): PosePersonFrame[] {
  return landmarksList.map((landmarks, personIndex) => ({
    id: personIndex,
    landmarks: landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })),
  }));
}

/**
 * Plays the video in real time and samples ~5 frames/sec via requestVideoFrameCallback.
 * Sequential decode during normal playback is far cheaper than seeking to N arbitrary
 * timestamps (seeking forces the decoder to jump around, often from the nearest
 * keyframe, and was both slow and occasionally flaky). This also guarantees
 * monotonically increasing timestamps for free, which VIDEO mode requires.
 */
async function extractViaPlayback(
  video: RVFCVideo,
  landmarker: PoseLandmarker,
  duration: number,
  sessionOffsetMs: number,
  onProgress: (done: number, total: number) => void,
): Promise<PoseFrame[]> {
  const estimatedTotal = Math.max(1, Math.ceil(duration * SAMPLE_FPS));
  const frames: PoseFrame[] = [];
  // 절대 그리드(0, 0.1, 0.2, ...)를 기준으로 샘플링한다. "마지막으로 실제 샘플된 시각"을
  // 기준으로 다음 목표를 잡으면(t - lastSampledTime 방식) 매 프레임의 재생 타이밍 잡음이
  // 다음 목표에 그대로 누적돼서, 같은 영상을 두 번 추출해도 뒤로 갈수록 샘플 시각이 점점
  // 벌어진다. 절대 그리드는 매 목표가 이전 샘플과 무관하므로 이 누적 오차가 생기지 않는다.
  let nextGridTime = 0;

  await seekTo(video, 0);

  await new Promise<void>((resolve, reject) => {
    let stopped = false;

    function onFrame(_now: number, metadata: VideoFrameCallbackMetadata) {
      if (stopped) return;
      const t = metadata.mediaTime;
      if (t >= nextGridTime - 0.005) {
        while (nextGridTime <= t) nextGridTime += SAMPLE_STEP_SEC;
        const result = landmarker.detectForVideo(video, toGraphTimestampMs(sessionOffsetMs, t));
        frames.push({ timestamp: t, persons: toPosePersonFrames(result.landmarks) });
        onProgress(frames.length, Math.max(estimatedTotal, frames.length));
        if (frames.length === 1 || frames.length % 10 === 0) {
          console.log(`[pose] frame ${frames.length} @ ${t.toFixed(2)}s done`);
        }
      }
      if (!stopped) video.requestVideoFrameCallback!(onFrame);
    }

    function finish() {
      if (stopped) return;
      stopped = true;
      video.pause();
      video.playbackRate = 1;
      video.removeEventListener("ended", finish);
      video.removeEventListener("error", onError);
      resolve();
    }

    function onError() {
      if (stopped) return;
      stopped = true;
      video.playbackRate = 1;
      video.removeEventListener("ended", finish);
      video.removeEventListener("error", onError);
      reject(new Error("영상 재생 중 오류가 발생했어요."));
    }

    video.addEventListener("ended", finish, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.playbackRate = EXTRACTION_PLAYBACK_RATE;
    video.requestVideoFrameCallback!(onFrame);
    video.play().catch(onError);
  });

  return frames;
}

/** Fallback for browsers without requestVideoFrameCallback: seek to each sample point. */
async function extractViaSeeking(
  video: HTMLVideoElement,
  landmarker: PoseLandmarker,
  duration: number,
  sessionOffsetMs: number,
  onProgress: (done: number, total: number) => void,
): Promise<PoseFrame[]> {
  const timestamps: number[] = [];
  for (let t = 0; t < duration; t += SAMPLE_STEP_SEC) timestamps.push(t);
  if (timestamps.length === 0) timestamps.push(0);

  const frames: PoseFrame[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    await seekTo(video, t);
    const result = landmarker.detectForVideo(video, toGraphTimestampMs(sessionOffsetMs, t));
    frames.push({ timestamp: t, persons: toPosePersonFrames(result.landmarks) });
    onProgress(i + 1, timestamps.length);
  }
  return frames;
}

export async function extractPosesFromVideo(
  video: HTMLVideoElement,
  landmarker: PoseLandmarker,
  onProgress: (done: number, total: number) => void,
): Promise<PoseFrame[]> {
  const duration = await ensureFiniteDuration(video);
  console.log(`[pose] duration resolved to ${duration}s`);
  if (duration <= 0) {
    throw new Error("영상 길이를 읽지 못했어요. 다른 파일로 시도해주세요.");
  }

  const sessionOffsetMs = reserveTimestampSession(duration);
  console.log(`[pose] session timestamp offset ${sessionOffsetMs}ms (landmarker is reused across extractions)`);

  const rvfcVideo = video as RVFCVideo;
  if (typeof rvfcVideo.requestVideoFrameCallback === "function") {
    console.log("[pose] extracting via real-time playback (requestVideoFrameCallback)");
    return extractViaPlayback(rvfcVideo, landmarker, duration, sessionOffsetMs, onProgress);
  }
  console.log("[pose] requestVideoFrameCallback unsupported, falling back to seek-based extraction");
  return extractViaSeeking(video, landmarker, duration, sessionOffsetMs, onProgress);
}
