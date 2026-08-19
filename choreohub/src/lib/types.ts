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
  videoUrl: string; // object URL — session-only until Supabase Storage (Phase 6)
  durationSec: number;
  poseData: PoseFrame[];
}
