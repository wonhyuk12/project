export type ProjectStatus = "in_progress" | "completed";

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  songName: string;
  bpm: number | null;
  description: string;
  status: ProjectStatus;
  memberCount: number;
  versionCount: number;
  updatedAt: string; // ISO date
  thumbnailColor: string; // placeholder gradient seed until real thumbnails exist
}

export interface PoseLandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PosePersonFrame {
  id: number;
  landmarks: PoseLandmarkPoint[]; // 33 BlazePose landmarks
}

export interface PoseFrame {
  timestamp: number; // seconds, from video start
  persons: PosePersonFrame[];
}

export interface Version {
  id: string;
  projectId: string;
  label: string;
  createdAt: string; // ISO date
  createdBy: string; // 업로드한 사람의 user_id — "누가 만들었는지" 표시용
  videoUrl: string; // object URL — session-only until Supabase Storage (Phase 6)
  durationSec: number;
  poseData: PoseFrame[];
  /** 이 버전이 실제로 담당한 구간(초) — null이면 전체(보통 원작 v1). 구간별 크레딧 계산에 쓴다. */
  coversStart: number | null;
  coversEnd: number | null;
}

export type CollabPermission = "보기만" | "수정 제안" | "직접 수정";

export interface ProjectMember {
  userId: string;
  name: string | null;
  email: string | null;
  permission: CollabPermission;
  role: string; // 담당 파트 자유 서술(예: "포메이션 구성")
  counts: string; // 담당 구간(예: "count 09-16")
  addedAt: string;
}

export type ProposalStatus = "proposed" | "merged" | "declined";

export interface Proposal {
  id: string;
  projectId: string;
  authorId: string;
  title: string;
  note: string;
  startSec: number;
  endSec: number;
  videoUrl: string;
  durationSec: number;
  poseData: PoseFrame[];
  status: ProposalStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}
