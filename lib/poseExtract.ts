/**
 * 4단계: Capture/Live에서 실제로 쓸 클라이언트 사이드 포즈 추출.
 * 기존 uploadForAnalysis()는 Python 백엔드(/v1/jobs)를 호출했는데, 그 서버를 배포 안 하기로
 * 했으니(계획 문서 참고) 브라우저에서 직접 MediaPipe로 뽑는다. getPoseLandmarker/
 * driveFrameGrid/reserveTimestampSession/toGraphTimestampMs는 이미 lib/livePractice.ts에
 * 있는 걸 그대로 재사용한다(Live 화면이 이미 이 패턴으로 카메라를 실시간 추출하고 있었음).
 */
import {
  getPoseLandmarker, driveFrameGrid, reserveTimestampSession, toGraphTimestampMs,
  SAMPLE_FPS, type RVFCVideo,
} from './livePractice';

export interface ExtractedMotionFrame {
  time_ms: number;
  world_landmarks: { x: number; y: number; z: number; visibility: number }[];
  image_landmarks: { x: number; y: number; z: number; visibility: number }[];
}

export interface ExtractionResult {
  frames: ExtractedMotionFrame[];
  durationSec: number;
  width: number;
  height: number;
}

/** 영상 파일(webm/mp4 Blob)을 실제 재생시키면서(음소거) 프레임을 샘플링해 포즈를 뽑는다.
 *  영상 길이만큼 시간이 걸린다(실시간 재생 기반) — 짧은 안무 클립 기준으로는 충분히 빠르다. */
export function extractPoseFromBlob(
  blob: Blob,
  onProgress?: (doneSec: number, totalSec: number) => void,
): Promise<ExtractionResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video') as RVFCVideo;
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(blob);
    video.style.position = 'fixed';
    video.style.left = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    document.body.appendChild(video);

    const frames: ExtractedMotionFrame[] = [];
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      handle?.stop();
      URL.revokeObjectURL(video.src);
      video.remove();
    };
    let handle: { stop: () => void } | null = null;

    video.onerror = () => { cleanup(); reject(new Error('영상을 불러오지 못했어요.')); };

    video.onloadedmetadata = async () => {
      try {
        const landmarker = await getPoseLandmarker();
        const sessionOffsetMs = reserveTimestampSession(video.duration || 0);
        const width = video.videoWidth;
        const height = video.videoHeight;

        video.addEventListener('ended', () => {
          cleanup();
          resolve({ frames, durationSec: video.duration || 0, width, height });
        }, { once: true });

        await video.play();
        handle = driveFrameGrid(video, 1 / SAMPLE_FPS, (t) => {
          const result = landmarker.detectForVideo(video, toGraphTimestampMs(sessionOffsetMs, t));
          const image = result.landmarks[0] ?? [];
          const world = result.worldLandmarks[0] ?? image;
          frames.push({
            time_ms: Math.round(t * 1000),
            image_landmarks: image.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1 })),
            world_landmarks: world.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1 })),
          });
          onProgress?.(t, video.duration || 0);
        });
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('포즈 추출에 실패했어요.'));
      }
    };
  });
}
