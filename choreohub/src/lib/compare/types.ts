export interface WorstJoint {
  joint: string;
  avgDiffDeg: number;
}

export interface CompareSegment {
  label: string;
  start: number;
  end: number;
  score: number;
  worstJoints: WorstJoint[];
  /** 이 구간 프레임의 상당수가 카메라 거리/각도 때문에 관절이 안 보여서 비교에서
   *  제외됐다는 뜻 — 점수 자체는 정상 계산되지만 신뢰도가 낮을 수 있음을 알려준다. */
  lowVisibility: boolean;
}

export interface FrameScore {
  t: number;
  score: number;
}

/** 포즈 비교 엔진(pose-compare.ts)의 순수 계산 결과 — 어느 경로에서 왔는지는 모른다. */
export interface PoseCompareScore {
  overallScore: number; // 0~100, 소수 1자리
  mirrored: boolean;
  segments: CompareSegment[];
  frameScores: FrameScore[];
  /** segments 중 하나라도 lowVisibility면 true. */
  lowVisibility: boolean;
}

/** 실제로 화면에 보여주는 수치 비교 결과 — 경로 A/B(포즈 데이터가 있는 경우)에서만 존재한다. */
export interface CompareResult extends PoseCompareScore {
  referenceKind: "archive" | "upload";
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface RangePairResult {
  label?: string;
  refRange: TimeRange;
  userRange: TimeRange;
  score: number;
  mirrored: boolean;
  worstJoints: WorstJoint[];
  lengthWarning: boolean;
  lowVisibility: boolean;
  advice?: { whatsWrong: string; why: string; howToFix: string };
}

export interface AdviceSegment {
  start: number;
  end: number;
  whatsWrong: string;
  why: string;
  howToFix: string;
}

/** Gemini가 만들어주는 서술형 조언의 공통 형태 — 경로 A/B(수치 위) / 경로 C(수치 없이) 둘 다 이 모양. */
export interface AdviceContent {
  segments: AdviceSegment[];
  overallComment: string;
}

/** 경로 C(유튜브) 전용 — 포즈 데이터가 없어 수치 비교가 불가능하므로 Gemini 서술형 피드백만. */
export type DescriptiveSegment = AdviceSegment;

export interface DescriptiveResult extends AdviceContent {
  referenceKind: "youtube";
}

export type ReferenceSource =
  | { type: "archive"; versionId: string; projectId: string }
  | { type: "upload"; consentGiven: true }
  | { type: "youtube"; videoId: string; url: string; title: string; channelTitle: string };
