import type { SupabaseClient } from "@supabase/supabase-js";

export interface CommunityProject {
  id: string;
  title: string;
  songName: string;
  thumbnailColor: string;
  updatedAt: string;
  ownerId: string;
  likeCount: number;
  likedByMe: boolean;
}

export type AccessType = "다운로드" | "사용";
export type AccessStatus = "대기" | "승인" | "거절";

export interface AccessRequestRow {
  id: string;
  projectId: string;
  requesterId: string;
  type: AccessType;
  status: AccessStatus;
  createdAt: string;
}

/** 전체공개(is_public) 프로젝트 피드 — 좋아요 수/내가 눌렀는지까지 한 번에 붙여서 돌려준다. */
export async function fetchPublicFeed(supabase: SupabaseClient): Promise<CommunityProject[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projectRows, error } = await supabase
    .from("projects")
    .select("id, title, song_name, thumbnail_color, updated_at, user_id")
    .eq("is_public", true)
    .order("updated_at", { ascending: false });
  if (error || !projectRows) throw error ?? new Error("공개 프로젝트를 불러오지 못했어요.");

  const projectIds = projectRows.map((p) => p.id as string);
  if (projectIds.length === 0) return [];

  const { data: likeRows } = await supabase
    .from("project_likes")
    .select("project_id, user_id")
    .in("project_id", projectIds);

  const likeCountByProject = new Map<string, number>();
  const likedByMeSet = new Set<string>();
  for (const l of likeRows ?? []) {
    const pid = l.project_id as string;
    likeCountByProject.set(pid, (likeCountByProject.get(pid) ?? 0) + 1);
    if (user && l.user_id === user.id) likedByMeSet.add(pid);
  }

  return projectRows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    songName: row.song_name as string,
    thumbnailColor: row.thumbnail_color as string,
    updatedAt: (row.updated_at as string).slice(0, 10),
    ownerId: row.user_id as string,
    likeCount: likeCountByProject.get(row.id as string) ?? 0,
    likedByMe: likedByMeSet.has(row.id as string),
  }));
}

export async function fetchLikeState(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ count: number; likedByMe: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("project_likes")
    .select("user_id")
    .eq("project_id", projectId);
  if (error || !data) throw error ?? new Error("좋아요 정보를 불러오지 못했어요.");
  return {
    count: data.length,
    likedByMe: user ? data.some((r) => r.user_id === user.id) : false,
  };
}

export async function toggleLike(
  supabase: SupabaseClient,
  projectId: string,
  liked: boolean,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  if (liked) {
    const { error } = await supabase
      .from("project_likes")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("project_likes")
      .insert({ project_id: projectId, user_id: user.id });
    if (error) throw error;
  }
}

/** 다운로드/사용 허가를 요청한다 — 소유자에게 알림까지 서버(RPC)에서 같이 만들어준다. */
export async function requestAccess(
  supabase: SupabaseClient,
  projectId: string,
  type: AccessType,
): Promise<void> {
  const { error } = await supabase.rpc("request_project_access", {
    p_project_id: projectId,
    p_type: type,
  });
  if (error) throw error;
}

/** 내가 이 프로젝트에 보낸 요청들의 최신 상태 — 버튼을 "요청하기" ↔ "대기중"/"승인됨"으로 바꾸는 데 쓴다. */
export async function fetchMyAccessRequests(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Record<AccessType, AccessStatus | null>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { 다운로드: null, 사용: null };

  const { data, error } = await supabase
    .from("project_access_requests")
    .select("type, status")
    .eq("project_id", projectId)
    .eq("requester_id", user.id);
  if (error || !data) return { 다운로드: null, 사용: null };

  const result: Record<AccessType, AccessStatus | null> = { 다운로드: null, 사용: null };
  for (const row of data) {
    result[row.type as AccessType] = row.status as AccessStatus;
  }
  return result;
}

/** 소유자 입장 — 내 프로젝트로 들어온 요청 목록(대기 우선순 정렬은 화면에서 처리). */
export async function fetchIncomingAccessRequests(
  supabase: SupabaseClient,
  projectId: string,
): Promise<AccessRequestRow[]> {
  const { data, error } = await supabase
    .from("project_access_requests")
    .select("id, project_id, requester_id, type, status, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error || !data) throw error ?? new Error("요청 목록을 불러오지 못했어요.");
  return data.map((r) => ({
    id: r.id as string,
    projectId: r.project_id as string,
    requesterId: r.requester_id as string,
    type: r.type as AccessType,
    status: r.status as AccessStatus,
    createdAt: (r.created_at as string).slice(0, 10),
  }));
}

export async function decideAccessRequest(
  supabase: SupabaseClient,
  requestId: string,
  approve: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("decide_project_access_request", {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw error;
}
