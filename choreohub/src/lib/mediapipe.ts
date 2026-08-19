import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// Pinned to the installed npm package version to avoid CDN/JS-binding mismatches.
const WASM_BASE_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const LOAD_TIMEOUT_MS = 60000;
export const LOAD_TIMEOUT_SEC = LOAD_TIMEOUT_MS / 1000;

export type LoadStage = "wasm" | "model" | "done";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;
let logFilterInstalled = false;

// glog-style line: "W0817 21:50:32.652999 2196592 gl_context.cc:1119] ..."
const GLOG_LINE = /^[IWEF]\d{4}\s+\d{2}:\d{2}:\d{2}/;

/**
 * MediaPipe's WASM runtime writes its own internal (mostly harmless) diagnostic
 * logs straight to stderr, which some builds route through console.error instead
 * of console.warn/info. Next.js's dev overlay treats any console.error as an
 * application error and shows a full-screen crash screen for it — even though
 * nothing actually threw. This filters out only that specific glog-formatted
 * pattern; anything else still goes through console.error normally.
 */
function installMediapipeLogFilter() {
  if (logFilterInstalled) return;
  logFilterInstalled = true;
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && GLOG_LINE.test(first)) {
      console.debug("[mediapipe:internal]", ...args);
      return;
    }
    originalError(...args);
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

/** onStage fires only for the call that actually triggers loading (subsequent callers
 *  while it's already loading, or after it's cached, won't see intermediate stages). */
export function getPoseLandmarker(onStage?: (stage: LoadStage) => void): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    installMediapipeLogFilter();
    landmarkerPromise = withTimeout(
      (async () => {
        console.log("[mediapipe] fetching wasm fileset from", WASM_BASE_PATH);
        onStage?.("wasm");
        const t0 = performance.now();
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
        console.log(`[mediapipe] wasm fileset ready in ${(performance.now() - t0).toFixed(0)}ms`);

        console.log("[mediapipe] fetching model from", MODEL_ASSET_PATH);
        onStage?.("model");
        const t1 = performance.now();
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            // GPU delegate requires a bound `canvas` option (WebGL context) that we
            // don't set up here — CPU keeps this simple and works everywhere. This is
            // offline batch extraction (Phase 2), not a real-time constraint.
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 8,
        });
        console.log(`[mediapipe] model ready in ${(performance.now() - t1).toFixed(0)}ms`);
        onStage?.("done");
        return landmarker;
      })(),
      LOAD_TIMEOUT_MS,
      `포즈 인식 모델 로딩이 ${LOAD_TIMEOUT_SEC}초 넘게 걸려 중단했어요. 네트워크 상태를 확인해주세요.`,
    ).catch((err) => {
      console.error("[mediapipe] load failed:", err);
      // allow retry on next call instead of caching a rejected promise forever
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/**
 * 위 싱글턴과 별개로, 매번 새 인스턴스를 만든다. Pro 전용 5구간 병렬 추출에서 쓴다 — 각
 * 구간이 자기만의 독립된 스트리밍 그래프를 가져야 타임스탬프 단조증가 제약이 구간별로
 * 따로 적용되고, 5개가 서로 간섭하지 않는다(싱글턴 하나를 공유하면 안 됨).
 */
export async function createIndependentPoseLandmarker(): Promise<PoseLandmarker> {
  installMediapipeLogFilter();
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_PATH,
      delegate: "CPU",
    },
    runningMode: "VIDEO",
    numPoses: 8,
  });
}

export { PoseLandmarker };
