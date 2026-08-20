import { create } from "zustand";
import type { Proposal, ProposalStatus, PoseFrame } from "../types";
import { createClient } from "../supabase/client";
import { uploadVideo, getVideoUrl } from "../supabase/storage";
import { useProjectStore, rowToVersion, type VersionRow } from "../store";

export interface NewProposalInput {
  projectId: string;
  title: string;
  note: string;
  startSec: number;
  endSec: number;
  videoBlob: Blob;
  videoExt: string;
  durationSec: number;
  poseData: PoseFrame[];
}

interface ProposalRow {
  id: string;
  project_id: string;
  author_id: string;
  title: string;
  note: string;
  start_sec: number;
  end_sec: number;
  video_path: string;
  duration_sec: number;
  pose_data: PoseFrame[];
  status: ProposalStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

async function rowToProposal(
  supabase: ReturnType<typeof createClient>,
  row: ProposalRow,
): Promise<Proposal> {
  let videoUrl = "";
  try {
    videoUrl = await getVideoUrl(supabase, row.video_path);
  } catch (err) {
    console.error("[proposalStore] failed to sign video url", row.id, err);
  }
  return {
    id: row.id,
    projectId: row.project_id,
    authorId: row.author_id,
    title: row.title,
    note: row.note,
    startSec: Number(row.start_sec),
    endSec: Number(row.end_sec),
    videoUrl,
    durationSec: Number(row.duration_sec),
    poseData: row.pose_data,
    status: row.status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at ? row.decided_at.slice(0, 10) : null,
    createdAt: row.created_at.slice(0, 10),
  };
}

interface ProposalState {
  proposals: Proposal[];
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  addProposal: (input: NewProposalInput) => Promise<Proposal>;
  approveProposal: (proposalId: string) => Promise<void>;
  declineProposal: (proposalId: string) => Promise<void>;
  withdrawProposal: (proposalId: string) => Promise<void>;
}

export const useProposalStore = create<ProposalState>((set, get) => ({
  proposals: [],
  hydrated: false,
  loading: false,

  hydrate: async () => {
    if (get().loading) return;
    set({ loading: true });
    const supabase = createClient();
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[proposalStore] hydrate failed", error);
      set({ loading: false, hydrated: true });
      return;
    }
    const proposals = await Promise.all(
      (data as ProposalRow[] | null ?? []).map((row) => rowToProposal(supabase, row)),
    );
    set({ proposals, loading: false, hydrated: true });
  },

  addProposal: async (input) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요해요.");

    const videoPath = await uploadVideo(supabase, user.id, input.videoBlob, input.videoExt);

    const { data, error } = await supabase
      .from("proposals")
      .insert({
        project_id: input.projectId,
        author_id: user.id,
        title: input.title,
        note: input.note,
        start_sec: input.startSec,
        end_sec: input.endSec,
        video_path: videoPath,
        duration_sec: input.durationSec,
        pose_data: input.poseData,
      })
      .select()
      .single();
    if (error || !data) throw error ?? new Error("제안 저장에 실패했어요.");

    const proposal = await rowToProposal(supabase, data as ProposalRow);
    set((state) => ({ proposals: [proposal, ...state.proposals] }));
    return proposal;
  },

  approveProposal: async (proposalId) => {
    const supabase = createClient();
    const { data: versionId, error } = await supabase.rpc("merge_proposal", {
      p_proposal_id: proposalId,
    });
    if (error) throw error;

    const { data: versionRow, error: versionError } = await supabase
      .from("versions")
      .select("*")
      .eq("id", versionId)
      .single();
    if (!versionError && versionRow) {
      const videoUrl = await getVideoUrl(supabase, (versionRow as VersionRow).video_path);
      const version = rowToVersion(versionRow as VersionRow, videoUrl);
      useProjectStore.setState((state) => ({
        versions: [version, ...state.versions],
        projects: state.projects.map((p) =>
          p.id === version.projectId ? { ...p, versionCount: p.versionCount + 1 } : p,
        ),
      }));
    }

    set((state) => ({
      proposals: state.proposals.map((p) =>
        p.id === proposalId ? { ...p, status: "merged" as const } : p,
      ),
    }));
  },

  declineProposal: async (proposalId) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("proposals")
      .update({ status: "declined", decided_by: user?.id ?? null, decided_at: new Date().toISOString() })
      .eq("id", proposalId);
    if (error) throw error;
    set((state) => ({
      proposals: state.proposals.map((p) =>
        p.id === proposalId ? { ...p, status: "declined" as const } : p,
      ),
    }));
  },

  withdrawProposal: async (proposalId) => {
    const supabase = createClient();
    const { error } = await supabase.from("proposals").delete().eq("id", proposalId);
    if (error) throw error;
    set((state) => ({ proposals: state.proposals.filter((p) => p.id !== proposalId) }));
  },
}));
