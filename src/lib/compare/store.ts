import { create } from "zustand";
import type {
  AdviceContent,
  CompareResult,
  DescriptiveResult,
  RangePairResult,
  ReferenceSource,
} from "./types";
import type { PoseFrame } from "../types";
import { createClient } from "../supabase/client";
import { uploadVideo, getVideoUrl } from "../supabase/storage";

export interface RefVideoData {
  videoUrl: string;
  poseData: PoseFrame[];
  durationSec: number;
}

/** RangePairResult엔 목록에서 개별로 지우기 위한 id가 없어서, 저장할 때만 붙인다. */
export interface StoredRangePair extends RangePairResult {
  id: string;
}

export interface CompareRun {
  id: string;
  projectId: string;
  userVersionId: string;
  source: ReferenceSource;
  result?: CompareResult; // 경로 A/B — 즉시 계산됨
  descriptive?: DescriptiveResult; // 경로 C — Gemini가 채움, 그 전엔 비어있음
  advice?: AdviceContent; // 경로 A/B의 전체 비교에 대한 Gemini 조언 (수치는 이미 있고, 말만 채움)
  /** 경로 B(직접 업로드)일 때만 필요 — 아카이브는 useProjectStore에서 다시 찾을 수 있지만
   *  업로드 영상은 어디에도 저장돼 있지 않아서 재생하려면 여기 같이 들고 있어야 한다. */
  refVideo?: RefVideoData;
  rangePairs: StoredRangePair[]; // 구간 지정 비교(변경 5) 등록 목록 — 경로 A/B에서만 사용
  createdAt: string;
}

export interface NewCompareRunInput {
  projectId: string;
  userVersionId: string;
  source: ReferenceSource;
  result?: CompareResult;
  descriptive?: DescriptiveResult;
  advice?: AdviceContent;
  /** 경로 B일 때만: 레퍼런스로 직접 업로드한 영상 원본 — Storage에 올려서 videos_path로
   *  저장한다(새로고침해도 재생 가능하게). */
  refVideo?: { blob: Blob; ext: string; poseData: PoseFrame[]; durationSec: number };
}

interface CompareRunRow {
  id: string;
  project_id: string;
  user_version_id: string;
  source: ReferenceSource;
  result: CompareResult | null;
  descriptive: DescriptiveResult | null;
  advice: AdviceContent | null;
  ref_video: { video_path: string; pose_data: PoseFrame[]; duration_sec: number } | null;
  range_pairs: StoredRangePair[];
  created_at: string;
}

async function rowToRun(
  supabase: ReturnType<typeof createClient>,
  row: CompareRunRow,
): Promise<CompareRun> {
  let refVideo: RefVideoData | undefined;
  if (row.ref_video) {
    try {
      const videoUrl = await getVideoUrl(supabase, row.ref_video.video_path);
      refVideo = {
        videoUrl,
        poseData: row.ref_video.pose_data,
        durationSec: Number(row.ref_video.duration_sec),
      };
    } catch (err) {
      console.error("[compareStore] failed to sign ref video url for run", row.id, err);
    }
  }

  return {
    id: row.id,
    projectId: row.project_id,
    userVersionId: row.user_version_id,
    source: row.source,
    result: row.result ?? undefined,
    descriptive: row.descriptive ?? undefined,
    advice: row.advice ?? undefined,
    refVideo,
    rangePairs: row.range_pairs ?? [],
    createdAt: row.created_at.slice(0, 10),
  };
}

interface CompareState {
  runs: CompareRun[];
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  addRun: (input: NewCompareRunInput) => Promise<CompareRun>;
  setDescriptive: (runId: string, descriptive: DescriptiveResult) => Promise<void>;
  setAdvice: (runId: string, advice: AdviceContent) => Promise<void>;
  addRangePair: (runId: string, pair: RangePairResult) => Promise<void>;
  removeRangePair: (runId: string, pairId: string) => Promise<void>;
  setRangePairAdvice: (
    runId: string,
    pairId: string,
    advice: { whatsWrong: string; why: string; howToFix: string },
  ) => Promise<void>;
}

export const useCompareStore = create<CompareState>((set, get) => ({
  runs: [],
  hydrated: false,
  loading: false,

  hydrate: async () => {
    if (get().loading) return;
    set({ loading: true });
    const supabase = createClient();
    const { data, error } = await supabase
      .from("compare_runs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[compareStore] hydrate failed", error);
      set({ loading: false, hydrated: true });
      return;
    }
    const runs = await Promise.all(
      (data as CompareRunRow[] | null ?? []).map((row) => rowToRun(supabase, row)),
    );
    set({ runs, loading: false, hydrated: true });
  },

  addRun: async (input) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요해요.");

    let refVideoColumn: CompareRunRow["ref_video"] = null;
    if (input.refVideo) {
      const videoPath = await uploadVideo(
        supabase,
        user.id,
        input.refVideo.blob,
        input.refVideo.ext,
      );
      refVideoColumn = {
        video_path: videoPath,
        pose_data: input.refVideo.poseData,
        duration_sec: input.refVideo.durationSec,
      };
    }

    const { data, error } = await supabase
      .from("compare_runs")
      .insert({
        user_id: user.id,
        project_id: input.projectId,
        user_version_id: input.userVersionId,
        source: input.source,
        result: input.result ?? null,
        descriptive: input.descriptive ?? null,
        advice: input.advice ?? null,
        ref_video: refVideoColumn,
        range_pairs: [],
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "비교 결과 저장에 실패했어요.");

    const run = await rowToRun(supabase, data as CompareRunRow);
    set((state) => ({ runs: [run, ...state.runs] }));
    return run;
  },

  setDescriptive: async (runId, descriptive) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("compare_runs")
      .update({ descriptive })
      .eq("id", runId);
    if (error) throw error;
    set((state) => ({
      runs: state.runs.map((r) => (r.id === runId ? { ...r, descriptive } : r)),
    }));
  },

  setAdvice: async (runId, advice) => {
    const supabase = createClient();
    const { error } = await supabase.from("compare_runs").update({ advice }).eq("id", runId);
    if (error) throw error;
    set((state) => ({
      runs: state.runs.map((r) => (r.id === runId ? { ...r, advice } : r)),
    }));
  },

  addRangePair: async (runId, pair) => {
    const run = get().runs.find((r) => r.id === runId);
    if (!run) return;
    const nextPairs: StoredRangePair[] = [{ ...pair, id: `rp-${Date.now()}` }, ...run.rangePairs];
    const supabase = createClient();
    const { error } = await supabase
      .from("compare_runs")
      .update({ range_pairs: nextPairs })
      .eq("id", runId);
    if (error) throw error;
    set((state) => ({
      runs: state.runs.map((r) => (r.id === runId ? { ...r, rangePairs: nextPairs } : r)),
    }));
  },

  removeRangePair: async (runId, pairId) => {
    const run = get().runs.find((r) => r.id === runId);
    if (!run) return;
    const nextPairs = run.rangePairs.filter((p) => p.id !== pairId);
    const supabase = createClient();
    const { error } = await supabase
      .from("compare_runs")
      .update({ range_pairs: nextPairs })
      .eq("id", runId);
    if (error) throw error;
    set((state) => ({
      runs: state.runs.map((r) => (r.id === runId ? { ...r, rangePairs: nextPairs } : r)),
    }));
  },

  setRangePairAdvice: async (runId, pairId, advice) => {
    const run = get().runs.find((r) => r.id === runId);
    if (!run) return;
    const nextPairs = run.rangePairs.map((p) => (p.id === pairId ? { ...p, advice } : p));
    const supabase = createClient();
    const { error } = await supabase
      .from("compare_runs")
      .update({ range_pairs: nextPairs })
      .eq("id", runId);
    if (error) throw error;
    set((state) => ({
      runs: state.runs.map((r) => (r.id === runId ? { ...r, rangePairs: nextPairs } : r)),
    }));
  },
}));
