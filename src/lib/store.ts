import { create } from "zustand";
import type { Project, ProjectStatus, Version, PoseFrame } from "./types";
import { createClient } from "./supabase/client";
import { uploadVideo, getVideoUrl } from "./supabase/storage";

export interface NewProjectInput {
  title: string;
  songName: string;
  bpm: number | null;
  description: string;
  status: ProjectStatus;
  memberCount: number;
  thumbnailColor: string;
  isPublic: boolean;
}

export interface NewVersionInput {
  projectId: string;
  label: string;
  videoBlob: Blob;
  videoExt: string;
  durationSec: number;
  poseData: PoseFrame[];
  coversStart?: number | null;
  coversEnd?: number | null;
}

interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  song_name: string;
  bpm: number | null;
  description: string;
  status: ProjectStatus;
  member_count: number;
  thumbnail_color: string;
  updated_at: string;
  is_public: boolean;
}

export interface VersionRow {
  id: string;
  project_id: string;
  user_id: string;
  label: string;
  video_path: string;
  duration_sec: number;
  pose_data: PoseFrame[];
  created_at: string;
  covers_start_sec: number | null;
  covers_end_sec: number | null;
}

function rowToProject(row: ProjectRow, versionCount: number): Project {
  return {
    id: row.id,
    ownerId: row.user_id,
    title: row.title,
    songName: row.song_name,
    bpm: row.bpm,
    description: row.description,
    status: row.status,
    memberCount: row.member_count,
    versionCount,
    updatedAt: row.updated_at.slice(0, 10),
    thumbnailColor: row.thumbnail_color,
    isPublic: row.is_public,
  };
}

export function rowToVersion(row: VersionRow, videoUrl: string): Version {
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    createdAt: row.created_at.slice(0, 10),
    createdBy: row.user_id,
    videoUrl,
    durationSec: Number(row.duration_sec),
    poseData: row.pose_data,
    coversStart: row.covers_start_sec == null ? null : Number(row.covers_start_sec),
    coversEnd: row.covers_end_sec == null ? null : Number(row.covers_end_sec),
  };
}

interface ProjectState {
  projects: Project[];
  versions: Version[];
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  addProject: (input: NewProjectInput) => Promise<Project>;
  addVersion: (input: NewVersionInput) => Promise<Version>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  versions: [],
  hydrated: false,
  loading: false,

  hydrate: async () => {
    if (get().loading) return;
    set({ loading: true });
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      set({ loading: false, hydrated: true });
      return;
    }

    // RLS가 "전체공개" 프로젝트까지 select 가능하게 열어놔서(커뮤니티 기능), 필터 없이
    // select("*")를 하면 남의 공개 프로젝트까지 "내 프로젝트"에 섞여 들어온다 — 여기서는
    // 항상 소유자이거나 멤버인 것만 명시적으로 골라온다. 공개 피드는 별도 쿼리(community).
    const { data: memberRows, error: memberError } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id);
    if (memberError) {
      console.error("[store] hydrate failed", memberError);
      set({ loading: false, hydrated: true });
      return;
    }
    const memberProjectIds = (memberRows ?? []).map((r) => r.project_id as string);

    const projectsQuery =
      memberProjectIds.length > 0
        ? supabase
            .from("projects")
            .select("*")
            .or(`user_id.eq.${user.id},id.in.(${memberProjectIds.join(",")})`)
        : supabase.from("projects").select("*").eq("user_id", user.id);

    const { data: projectRows, error: projectError } = await projectsQuery.order("updated_at", {
      ascending: false,
    });
    if (projectError) {
      console.error("[store] hydrate failed", projectError);
      set({ loading: false, hydrated: true });
      return;
    }

    const myProjectIds = (projectRows ?? []).map((p) => p.id as string);
    const { data: versionRows, error: versionError } =
      myProjectIds.length > 0
        ? await supabase
            .from("versions")
            .select("*")
            .in("project_id", myProjectIds)
            .order("created_at", { ascending: false })
        : { data: [] as VersionRow[], error: null };
    if (versionError) {
      console.error("[store] hydrate failed", versionError);
      set({ loading: false, hydrated: true });
      return;
    }

    const versions = await Promise.all(
      (versionRows as VersionRow[] | null ?? []).map(async (row) => {
        try {
          const videoUrl = await getVideoUrl(supabase, row.video_path);
          return rowToVersion(row, videoUrl);
        } catch (err) {
          console.error("[store] failed to sign video url for version", row.id, err);
          return rowToVersion(row, "");
        }
      }),
    );

    const versionCountByProject = new Map<string, number>();
    for (const v of versions) {
      versionCountByProject.set(v.projectId, (versionCountByProject.get(v.projectId) ?? 0) + 1);
    }
    const projects = (projectRows as ProjectRow[] | null ?? []).map((row) =>
      rowToProject(row, versionCountByProject.get(row.id) ?? 0),
    );

    set({ projects, versions, loading: false, hydrated: true });
  },

  addProject: async (input) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요해요.");

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        title: input.title,
        song_name: input.songName,
        bpm: input.bpm,
        description: input.description,
        status: input.status,
        member_count: input.memberCount,
        thumbnail_color: input.thumbnailColor,
        is_public: input.isPublic,
      })
      .select()
      .single();
    // Supabase 쿼리 에러는 Error 인스턴스가 아닌 평범한 객체라 그냥 던지면 호출부의
    // `err instanceof Error` 체크에 안 걸려서 실제 원인(RLS 거부 등)이 가려진다.
    if (error || !data) throw new Error(error?.message ?? "프로젝트 생성에 실패했어요.");

    const project = rowToProject(data as ProjectRow, 0);
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  addVersion: async (input) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요해요.");

    const videoPath = await uploadVideo(supabase, user.id, input.videoBlob, input.videoExt);

    const { data, error } = await supabase
      .from("versions")
      .insert({
        user_id: user.id,
        project_id: input.projectId,
        label: input.label,
        video_path: videoPath,
        duration_sec: input.durationSec,
        pose_data: input.poseData,
        covers_start_sec: input.coversStart ?? null,
        covers_end_sec: input.coversEnd ?? null,
      })
      .select()
      .single();
    // Supabase 쿼리 에러는 Error 인스턴스가 아닌 평범한 객체라 그냥 던지면 호출부의
    // `err instanceof Error` 체크에 안 걸려서 실제 원인(RLS 거부 등)이 가려진다.
    if (error || !data) throw new Error(error?.message ?? "버전 저장에 실패했어요.");

    const videoUrl = await getVideoUrl(supabase, videoPath);
    const version = rowToVersion(data as VersionRow, videoUrl);
    set((state) => ({
      versions: [version, ...state.versions],
      projects: state.projects.map((p) =>
        p.id === input.projectId ? { ...p, versionCount: p.versionCount + 1 } : p,
      ),
    }));
    return version;
  },
}));
