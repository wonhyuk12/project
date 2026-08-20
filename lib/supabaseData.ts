/**
 * chisung42 프론트를 우리 Supabase 백엔드에 연결하는 데이터 레이어.
 * App.tsx의 `api('/v1/...')` 호출들을 이 함수들로 치환한다 — 3단계 범위(로그인,
 * Home/Library/New/Version/Collab)만 다룬다. 화면(JSX)은 원본 App.tsx의 타입(Project,
 * Collaborator, Me, License, CollabPermission)에 정확히 맞춰서 돌려준다.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type License = '연습 전용' | '비상업 커버 허용' | '리믹스 허용' | '상업 이용 협의';
export type CollabPermission = '보기만' | '수정 제안' | '직접 수정';
export type Collaborator = {
  id: string; user_id: string | null; name: string; role: string; counts: string;
  permission: CollabPermission; joined: boolean;
};
export type Project = {
  id: string; name: string; version: string; date: string; license: License; color: string;
  inviteCode: string; ownerId: string; ownerName: string; isOwner: boolean;
  viewerPermission: CollabPermission | null;
  sourceSha256?: string | null; videoUrl?: string | null;
  videoWidth?: number | null; videoHeight?: number | null; poseFrames?: number | null;
  workMs?: number | null;
  collaborators: Collaborator[];
};
export type Me = { user_id: string; name: string };

export type VersionEntry = {
  id: string; number: number | null; parentId: string | null; title: string; note: string;
  authorId: string; authorName: string; startMs: number | null; endMs: number | null; durationMs: number | null;
  segment: string; state: 'proposed' | 'merged' | 'declined'; date: string;
  decidedAt: string | null; decidedByName: string | null;
  sourceSha256?: string | null; poseFrames?: number | null;
  videoUrl?: string | null; videoWidth?: number | null; videoHeight?: number | null;
};
export type VersionGraph = {
  main: VersionEntry[]; proposed: VersionEntry[]; declined: VersionEntry[];
  canPropose: boolean; canDecide: boolean;
  headId: string | null; headPinned: boolean; headSetByName: string | null; headSetAt: string | null;
};

function segmentLabel(startSec: number | null, endSec: number | null): string {
  if (startSec == null || endSec == null) return '전체';
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return `${fmt(startSec)}~${fmt(endSec)}`;
}

function randomShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `CHO-${out}`;
}

/** 익명 로그인으로 이름만 받아서 시작한다(비밀번호 없음) — 이미 로그인돼 있으면 이름만 갱신. */
export async function signInQuick(name: string): Promise<Me> {
  const { data, error } = await supabase.auth.signInAnonymously({ options: { data: { name } } });
  if (error || !data.user) throw error ?? new Error('로그인에 실패했어요.');
  return { user_id: data.user.id, name };
}

export async function signOutQuick(): Promise<void> {
  await supabase.auth.signOut();
}

export async function restoreSession(): Promise<Me | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const name = (data.user.user_metadata?.name as string | undefined) ?? '';
  return { user_id: data.user.id, name };
}

async function uploadVideo(userId: string, blob: Blob, ext: string): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('videos').upload(path, blob, {
    contentType: blob.type || undefined,
  });
  if (error) throw error;
  return path;
}

async function getVideoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('videos').createSignedUrl(path, 60 * 60 * 6);
  if (error || !data) throw error ?? new Error('영상 URL을 가져오지 못했어요.');
  return data.signedUrl;
}

async function profileNamesFor(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from('profiles').select('id, name, email').in('id', ids);
  return new Map((data ?? []).map((p: any) => [p.id, p.name || p.email || '이름 없음']));
}

/** 프로젝트 하나에 붙는 초대 코드 — 없으면(소유자일 때만) 새로 만든다. */
async function ensureShortCode(projectId: string, isOwner: boolean): Promise<string> {
  const { data: existing } = await supabase
    .from('project_invites')
    .select('short_code')
    .eq('project_id', projectId)
    .not('short_code', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.short_code) return existing.short_code;
  if (!isOwner) return '';

  const { data: proj } = await supabase.from('projects').select('title').eq('id', projectId).single();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomShortCode();
    const { error } = await supabase.from('project_invites').insert({
      project_id: projectId,
      project_title: proj?.title ?? '',
      short_code: code,
    });
    if (!error) return code;
  }
  return '';
}

/** Home/Library를 채우는 프로젝트 목록. RLS가 이미 "소유자이거나 멤버인 것"만 돌려준다. */
export async function fetchProjectsForUser(userId: string): Promise<Project[]> {
  const { data: rows, error } = await supabase
    .from('projects')
    .select('*, project_members(*)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const ownerIds = rows.map((r: any) => r.user_id);
  const memberIds = rows.flatMap((r: any) => (r.project_members ?? []).map((m: any) => m.user_id).filter(Boolean));
  const names = await profileNamesFor([...ownerIds, ...memberIds]);

  const projects: Project[] = [];
  for (const row of rows as any[]) {
    const isOwner = row.user_id === userId;
    const myMembership = (row.project_members ?? []).find((m: any) => m.user_id === userId);

    const { data: versions } = await supabase
      .from('versions')
      .select('id, video_path, pose_data, duration_sec, created_at')
      .eq('project_id', row.id)
      .order('created_at', { ascending: false });
    const latest = versions?.[0];

    let videoUrl: string | null = null;
    if (latest?.video_path) {
      try {
        videoUrl = await getVideoUrl(latest.video_path);
      } catch {
        videoUrl = null;
      }
    }

    const inviteCode = await ensureShortCode(row.id, isOwner);

    projects.push({
      id: row.id,
      name: row.title,
      version: `v${versions?.length ?? 0}`,
      date: (row.updated_at as string).slice(0, 10),
      license: row.license,
      color: row.thumbnail_color ?? '#7FA5FF',
      inviteCode,
      ownerId: row.user_id,
      ownerName: names.get(row.user_id) ?? '이름 없음',
      isOwner,
      viewerPermission: isOwner ? null : (myMembership?.permission ?? null),
      videoUrl,
      poseFrames: latest?.pose_data?.length ?? 0,
      workMs: latest?.duration_sec ? Math.round(Number(latest.duration_sec) * 1000) : null,
      collaborators: (row.project_members ?? []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        name: m.user_id ? (names.get(m.user_id) ?? m.invited_name ?? '이름 없음') : (m.invited_name ?? '초대 대기'),
        role: m.role ?? '',
        counts: m.counts ?? '',
        permission: m.permission,
        joined: !!m.user_id,
      })),
    });
  }
  return projects;
}

/** 새 프로젝트 + 그 첫 영상(버전)을 만든다. 포즈 추출(mediapipe)은 4단계에서 붙이므로
 *  지금은 pose_data를 빈 배열로 저장한다 — 영상 재생은 되지만 스켈레톤/분석은 아직 없다. */
export function probeVideoDuration(uri: string, fallbackSec = 0): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = uri;
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : fallbackSec);
    v.onerror = () => resolve(fallbackSec);
  });
}

export async function createProjectWithVideo(input: {
  userId: string;
  name: string;
  license: License;
  color: string;
  videoBlob: Blob;
  videoExt: string;
  durationSec: number;
  poseData?: unknown[];
}): Promise<Project> {
  const { data: projectRow, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: input.userId,
      title: input.name,
      license: input.license,
      thumbnail_color: input.color,
    })
    .select()
    .single();
  if (projectError || !projectRow) throw projectError ?? new Error('프로젝트 생성에 실패했어요.');

  const videoPath = await uploadVideo(input.userId, input.videoBlob, input.videoExt);
  const { error: versionError } = await supabase.from('versions').insert({
    user_id: input.userId,
    project_id: projectRow.id,
    label: 'v1',
    video_path: videoPath,
    duration_sec: input.durationSec,
    pose_data: input.poseData ?? [],
  });
  if (versionError) throw versionError;

  const videoUrl = await getVideoUrl(videoPath);
  const inviteCode = await ensureShortCode(projectRow.id, true);

  return {
    id: projectRow.id,
    name: projectRow.title,
    version: 'v1',
    date: (projectRow.updated_at as string).slice(0, 10),
    license: projectRow.license,
    color: projectRow.thumbnail_color,
    inviteCode,
    ownerId: input.userId,
    ownerName: '',
    isOwner: true,
    viewerPermission: null,
    videoUrl,
    poseFrames: input.poseData?.length ?? 0,
    workMs: Math.round(input.durationSec * 1000),
    collaborators: [],
  };
}

/** 실시간 연습 결과 저장 — chisung42의 practice_runs 개념을 새 테이블 없이 기존
 *  compare_runs로 대체한다(계획 문서 6번 항목).
 *  주의: 우리 compare_runs.user_version_id는 NOT NULL FK라 "어떤 버전을 채점했는지"가
 *  반드시 있어야 한다 — chisung42 원안(연습은 버전 이력과 완전히 분리)과 달리, 녹화본도
 *  versions에 한 행으로 저장한 뒤 그 id를 채점 대상으로 넣는다(우리 Next.js 앱의 실시간
 *  연습과 동일한 방식). 라이선스/구간 편집 흐름에는 안 보이지만 "버전 타임라인"엔 뜬다. */
export async function saveLivePracticeRun(input: {
  userId: string;
  projectId: string;
  referenceVersionId: string | null;
  videoBlob: Blob;
  videoExt: string;
  durationSec: number;
  poseData: unknown[];
  overallScore: number;
  mirrored: boolean;
}): Promise<void> {
  const videoPath = await uploadVideo(input.userId, input.videoBlob, input.videoExt);
  const { data: versionRow, error: versionError } = await supabase
    .from('versions')
    .insert({
      user_id: input.userId,
      project_id: input.projectId,
      label: `실시간 연습 · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      video_path: videoPath,
      duration_sec: input.durationSec,
      pose_data: input.poseData,
    })
    .select('id')
    .single();
  if (versionError || !versionRow) throw versionError ?? new Error('연습 영상을 저장하지 못했어요.');

  const { error } = await supabase.from('compare_runs').insert({
    user_id: input.userId,
    project_id: input.projectId,
    user_version_id: versionRow.id,
    source: { type: 'archive', versionId: input.referenceVersionId, projectId: input.projectId },
    result: { overallScore: input.overallScore, mirrored: input.mirrored, referenceKind: 'archive' },
  });
  if (error) throw error;
}

/** 프로젝트의 최신 버전이 들고 있는 pose_data(PoseFrame[])를 Overlay/Data 화면이 기대하는
 *  MotionFrame[] 모양으로 되돌린다. 주의: 우리 스키마는 world_landmarks를 따로 저장하지
 *  않아서(image_landmarks만 있음), world_landmarks는 image_landmarks로 채워 넣는다 —
 *  3D 스켈레톤 뷰가 완전히 정확한 원근은 아니지만 빈 화면보다는 낫다. */
export async function fetchLatestVersionFrames(projectId: string): Promise<{
  frames: { time_ms: number; image_landmarks: any[]; world_landmarks: any[] }[];
  width: number; height: number;
}> {
  const { data } = await supabase
    .from('versions')
    .select('pose_data')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const poseData: { timestamp: number; persons: { landmarks: any[] }[] }[] = data?.pose_data ?? [];
  const frames = poseData.map((f) => {
    const landmarks = f.persons[0]?.landmarks ?? [];
    return { time_ms: Math.round(f.timestamp * 1000), image_landmarks: landmarks, world_landmarks: landmarks };
  });
  return { frames, width: 0, height: 0 };
}

export async function joinProjectByCode(code: string, userId: string): Promise<Project> {
  const { data: invite, error } = await supabase
    .from('project_invites')
    .select('project_id, expires_at')
    .eq('short_code', code.trim().toUpperCase())
    .maybeSingle();
  if (error || !invite) throw new Error('초대 코드를 찾을 수 없어요.');
  if (new Date(invite.expires_at as string) < new Date()) throw new Error('만료된 초대 코드예요.');

  const { error: joinError } = await supabase
    .from('project_members')
    .insert({ project_id: invite.project_id, user_id: userId });
  if (joinError && !String(joinError.message).includes('duplicate')) throw joinError;

  const all = await fetchProjectsForUser(userId);
  const joined = all.find((p) => p.id === invite.project_id);
  if (!joined) throw new Error('참여 후 프로젝트를 찾지 못했어요.');
  return joined;
}

export async function saveCollaboratorRow(input: {
  projectId: string;
  memberId?: string; // 기존 행 수정이면 project_members.id
  userId?: string | null;
  invitedName?: string;
  role: string;
  counts: string;
  permission: CollabPermission;
}): Promise<void> {
  if (input.memberId) {
    const { error } = await supabase
      .from('project_members')
      .update({ role: input.role, counts: input.counts, permission: input.permission })
      .eq('id', input.memberId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('project_members').insert({
    project_id: input.projectId,
    user_id: input.userId ?? null,
    invited_name: input.userId ? null : (input.invitedName ?? ''),
    role: input.role,
    counts: input.counts,
    permission: input.permission,
  });
  if (error) throw error;
}

export async function removeCollaboratorRow(memberId: string): Promise<void> {
  const { error } = await supabase.from('project_members').delete().eq('id', memberId);
  if (error) throw error;
}

/** 5단계: Analysis/Motion. 우리 스키마는 chisung42의 단일 versions(git 그래프, number/
 *  parentId/state) 대신 versions(반영 완료) + proposals(대기/거절) 두 테이블로 나눠져 있다 —
 *  합치지 않고 여기서 클라이언트 조합으로 VersionGraph 모양을 만든다(계획 문서 참고).
 *  head 이동(같은 이력에서 보여줄 버전만 바꾸는 기능)은 우리 스키마에 그 개념이 없어서
 *  최신 버전 = head로 고정한다 — setHead()는 손대지 않는다(App.tsx에서 호출 자체를 막음). */
export async function fetchVersionGraph(projectId: string, userId: string): Promise<VersionGraph> {
  const [{ data: versionRows }, { data: proposalRows }, { data: projectRow }, { data: memberRow }] =
    await Promise.all([
      supabase.from('versions').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('proposals').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('projects').select('user_id').eq('id', projectId).single(),
      supabase.from('project_members').select('permission').eq('project_id', projectId).eq('user_id', userId).maybeSingle(),
    ]);

  const isOwner = projectRow?.user_id === userId;
  const permission = memberRow?.permission as CollabPermission | undefined;
  const canPropose = isOwner || permission === '수정 제안' || permission === '직접 수정';
  const canDecide = isOwner;

  const vRows = versionRows ?? [];
  const pRows = proposalRows ?? [];
  const names = await profileNamesFor([
    ...vRows.map((v: any) => v.user_id),
    ...pRows.map((p: any) => p.author_id),
  ]);

  const main: VersionEntry[] = await Promise.all(
    vRows.map(async (row: any, idx: number) => ({
      id: row.id,
      number: idx + 1,
      parentId: idx > 0 ? vRows[idx - 1].id : null,
      title: row.label,
      note: '',
      authorId: row.user_id,
      authorName: names.get(row.user_id) ?? '이름 없음',
      startMs: row.covers_start_sec != null ? Math.round(Number(row.covers_start_sec) * 1000) : null,
      endMs: row.covers_end_sec != null ? Math.round(Number(row.covers_end_sec) * 1000) : null,
      durationMs: Math.round(Number(row.duration_sec) * 1000),
      segment: segmentLabel(row.covers_start_sec, row.covers_end_sec),
      state: 'merged' as const,
      date: (row.created_at as string).slice(0, 10),
      decidedAt: null,
      decidedByName: null,
      sourceSha256: row.id, // 원본엔 해시로 영상 동일성을 확인하지만, 우리는 그냥 행 id로 "영상 있음"만 표시
      poseFrames: (row.pose_data as unknown[])?.length ?? 0,
      videoUrl: await getVideoUrl(row.video_path).catch(() => null),
    })),
  );

  async function mapProposal(row: any, state: 'proposed' | 'declined'): Promise<VersionEntry> {
    return {
      id: row.id,
      number: null,
      parentId: null,
      title: row.title,
      note: row.note ?? '',
      authorId: row.author_id,
      authorName: names.get(row.author_id) ?? '이름 없음',
      startMs: Math.round(Number(row.start_sec) * 1000),
      endMs: Math.round(Number(row.end_sec) * 1000),
      durationMs: Math.round(Number(row.duration_sec) * 1000),
      segment: segmentLabel(row.start_sec, row.end_sec),
      state,
      date: (row.created_at as string).slice(0, 10),
      decidedAt: row.decided_at ? (row.decided_at as string).slice(0, 10) : null,
      decidedByName: row.decided_by ? (names.get(row.decided_by) ?? null) : null,
      sourceSha256: row.id,
      poseFrames: (row.pose_data as unknown[])?.length ?? 0,
      videoUrl: await getVideoUrl(row.video_path).catch(() => null),
    };
  }

  const proposed = await Promise.all(pRows.filter((p: any) => p.status === 'proposed').map((p: any) => mapProposal(p, 'proposed')));
  const declined = await Promise.all(pRows.filter((p: any) => p.status === 'declined').map((p: any) => mapProposal(p, 'declined')));

  return {
    main, proposed, declined, canPropose, canDecide,
    headId: main.length ? main[main.length - 1].id : null,
    headPinned: false, headSetByName: null, headSetAt: null,
  };
}

/** 제안 제출 — '직접 수정' 권한이면 승인 절차 없이 바로 versions에 반영(merged: true),
 *  아니면 proposals에 대기로 들어간다(merged: false). */
export async function submitProposalRow(input: {
  projectId: string; userId: string; title: string; note: string;
  startSec: number; endSec: number; videoBlob: Blob; videoExt: string;
  durationSec: number; poseData: unknown[]; canEditDirect: boolean;
}): Promise<{ merged: boolean }> {
  const videoPath = await uploadVideo(input.userId, input.videoBlob, input.videoExt);

  if (input.canEditDirect) {
    const { error } = await supabase.from('versions').insert({
      user_id: input.userId, project_id: input.projectId, label: input.title,
      video_path: videoPath, duration_sec: input.durationSec, pose_data: input.poseData,
      covers_start_sec: input.startSec, covers_end_sec: input.endSec,
    });
    if (error) throw error;
    return { merged: true };
  }

  const { error } = await supabase.from('proposals').insert({
    project_id: input.projectId, author_id: input.userId, title: input.title, note: input.note,
    start_sec: input.startSec, end_sec: input.endSec, video_path: videoPath,
    duration_sec: input.durationSec, pose_data: input.poseData,
  });
  if (error) throw error;
  return { merged: false };
}

export async function approveProposalRow(proposalId: string): Promise<void> {
  const { error } = await supabase.rpc('merge_proposal', { p_proposal_id: proposalId });
  if (error) throw error;
}

export async function declineProposalRow(proposalId: string, deciderId: string): Promise<void> {
  const { error } = await supabase
    .from('proposals')
    .update({ status: 'declined', decided_by: deciderId, decided_at: new Date().toISOString() })
    .eq('id', proposalId);
  if (error) throw error;
}

export async function updateProjectMeta(projectId: string, name: string, license: License): Promise<void> {
  const { error } = await supabase.from('projects').update({ title: name, license }).eq('id', projectId);
  if (error) throw error;
}

/** Analysis 페이지에서 특정 버전/제안 하나를 골라 비교할 때 쓴다 — main(versions)이든
 *  검토 중/거절된 제안(proposals)이든 id 하나로 어느 쪽인지 몰라도 찾아준다. */
export async function fetchFramesById(id: string): Promise<{
  time_ms: number; image_landmarks: any[]; world_landmarks: any[];
}[]> {
  const { data: versionRow } = await supabase.from('versions').select('pose_data').eq('id', id).maybeSingle();
  const row = versionRow ?? (await supabase.from('proposals').select('pose_data').eq('id', id).maybeSingle()).data;
  const poseData: { timestamp: number; persons: { landmarks: any[] }[] }[] = row?.pose_data ?? [];
  return poseData.map((f) => {
    const landmarks = f.persons[0]?.landmarks ?? [];
    return { time_ms: Math.round(f.timestamp * 1000), image_landmarks: landmarks, world_landmarks: landmarks };
  });
}

/* ---------------------------------------------------------------------------
 * 6단계: Community / Profile.
 * RLS가 "공개 라이선스거나 나와 같은 프로젝트에 있는 사람"만 보여주므로, 남의 프로필의
 * owned/joined 같은 통계는 내가 접근 가능한 범위만큼만 정확하다(그 사람의 비공개
 * 프로젝트는 애초에 안 보임) — 의도된 동작이다.
 * ------------------------------------------------------------------------- */

export type ContributionDay = { d: string; c: number };
export type Community = {
  people: { user_id: string; name: string; handle: string; works: number; isMe: boolean; followers: number; following: number; isFollowing: boolean }[];
  feed: { id: string; name: string; color: string; license: License; version: string; ownerId: string; ownerName: string; people: number; poseFrames: number | null; date: string }[];
};
export type Profile = {
  user_id: string; name: string; handle: string; joinedAt: string;
  isMe: boolean; followers: number; following: number; isFollowing: boolean;
  stats: { owned: number; joined: number; people: number; frames: number };
  contributions: { weeks: ContributionDay[][]; months: { label: string; week: number }[]; total: number };
  projects: { id: string; name: string; color: string; license: License; version: string; isOwner: boolean }[];
  activity: { kind: string; text: string; date: string }[];
};

function handleOf(name: string, userId: string): string {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '');
  return slug || userId.slice(0, 8);
}

async function followCounts(userId: string, viewerId: string) {
  const [{ count: followers }, { count: following }, { data: mine }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    supabase.from('follows').select('follower_id').eq('follower_id', viewerId).eq('following_id', userId).maybeSingle(),
  ]);
  return { followers: followers ?? 0, following: following ?? 0, isFollowing: !!mine };
}

/** 로그인만 하면 볼 수 있는 "공개된" 작업들(license != '연습 전용')과 그 소유자들. */
export async function fetchCommunity(viewerId: string): Promise<Community> {
  const { data: publicProjects } = await supabase
    .from('projects')
    .select('id, title, thumbnail_color, license, user_id, updated_at')
    .neq('license', '연습 전용')
    .order('updated_at', { ascending: false })
    .limit(30);
  const rows = publicProjects ?? [];

  const ownerIds = [...new Set(rows.map((r: any) => r.user_id))];
  const names = await profileNamesFor(ownerIds);

  const feed = await Promise.all(rows.map(async (row: any) => {
    const { count: memberCount } = await supabase
      .from('project_members').select('*', { count: 'exact', head: true }).eq('project_id', row.id);
    const { count: versionCount } = await supabase
      .from('versions').select('*', { count: 'exact', head: true }).eq('project_id', row.id);
    const { data: latestVersion } = await supabase
      .from('versions').select('pose_data').eq('project_id', row.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return {
      id: row.id, name: row.title, color: row.thumbnail_color, license: row.license,
      version: `v${versionCount ?? 0}`, ownerId: row.user_id, ownerName: names.get(row.user_id) ?? '이름 없음',
      people: (memberCount ?? 0) + 1, poseFrames: (latestVersion?.pose_data as unknown[])?.length ?? null,
      date: (row.updated_at as string).slice(0, 10),
    };
  }));

  const people = await Promise.all(ownerIds.map(async (id) => {
    const counts = await followCounts(id, viewerId);
    const works = rows.filter((r: any) => r.user_id === id).length;
    return {
      user_id: id, name: names.get(id) ?? '이름 없음', handle: handleOf(names.get(id) ?? '', id),
      works, isMe: id === viewerId, ...counts,
    };
  }));

  return { people, feed };
}

/** 지난 1년 활동(버전 게시 + 제안)을 GitHub 스타일 주간 그리드로 묶는다. */
function buildContributions(dates: string[]): Profile['contributions'] {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(d, (counts.get(d) ?? 0) + 1);

  const today = new Date();
  const days: ContributionDay[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ d: key, c: counts.get(key) ?? 0 });
  }
  // 첫 주를 일요일부터 시작하게 앞을 빈 칸(count -1 아님, 그냥 0)으로 채운다
  const firstDow = new Date(days[0].d).getDay();
  const padded = [...Array(firstDow).fill(null).map((_, i) => ({ d: `pad-${i}`, c: 0 })), ...days];

  const weeks: ContributionDay[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  const months: { label: string; week: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, weekIndex) => {
    const firstReal = week.find((d) => !d.d.startsWith('pad-'));
    if (!firstReal) return;
    const month = new Date(firstReal.d).getMonth();
    if (month !== lastMonth) {
      months.push({ label: `${month + 1}월`, week: weekIndex });
      lastMonth = month;
    }
  });

  return { weeks, months, total: dates.length };
}

export async function fetchProfile(userId: string, viewerId: string): Promise<Profile> {
  const { data: profileRow } = await supabase.from('profiles').select('name, email').eq('id', userId).maybeSingle();
  const name = profileRow?.name || profileRow?.email || '이름 없음';

  const [{ data: ownedProjects }, counts] = await Promise.all([
    supabase.from('projects').select('id, title, thumbnail_color, license, user_id').eq('user_id', userId),
    followCounts(userId, viewerId),
  ]);
  // RLS상 남의 project_members 행은 내가 그 프로젝트 소유자가 아니면 안 보인다 —
  // 그래서 "참여 중인 프로젝트"는 뷰어가 접근 가능한 범위 안에서만 정확하다.
  const { data: memberRows } = await supabase.from('project_members').select('project_id, projects(id, title, thumbnail_color, license)').eq('user_id', userId);

  const owned = (ownedProjects ?? []).map((p: any) => ({
    id: p.id, name: p.title, color: p.thumbnail_color, license: p.license, version: 'v', isOwner: true,
  }));
  const joined = (memberRows ?? [])
    .filter((m: any) => m.projects)
    .map((m: any) => ({
      id: m.projects.id, name: m.projects.title, color: m.projects.thumbnail_color,
      license: m.projects.license, version: 'v', isOwner: false,
    }));
  const projects = [...owned, ...joined];

  const projectIds = (ownedProjects ?? []).map((p: any) => p.id);
  let frames = 0;
  let versionDates: string[] = [];
  if (projectIds.length) {
    const { data: versionRows } = await supabase.from('versions').select('pose_data, created_at').eq('user_id', userId);
    for (const v of versionRows ?? []) {
      frames += (v.pose_data as unknown[])?.length ?? 0;
      versionDates.push((v.created_at as string).slice(0, 10));
    }
  }
  const { data: proposalRows } = await supabase.from('proposals').select('created_at').eq('author_id', userId);
  const proposalDates = (proposalRows ?? []).map((p: any) => (p.created_at as string).slice(0, 10));

  const activity = [
    ...(await supabase.from('versions').select('label, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)).data?.map((v: any) => ({
      kind: 'version', text: `${v.label} 게시`, date: (v.created_at as string).slice(0, 10),
    })) ?? [],
    ...(await supabase.from('proposals').select('title, created_at').eq('author_id', userId).order('created_at', { ascending: false }).limit(10)).data?.map((p: any) => ({
      kind: 'propose', text: `"${p.title}" 제안`, date: (p.created_at as string).slice(0, 10),
    })) ?? [],
  ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 15);

  return {
    user_id: userId, name, handle: handleOf(name, userId),
    joinedAt: versionDates.sort()[0] ?? new Date().toISOString().slice(0, 10),
    isMe: userId === viewerId,
    ...counts,
    stats: { owned: owned.length, joined: joined.length, people: 0, frames },
    contributions: buildContributions([...versionDates, ...proposalDates]),
    projects,
    activity,
  };
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
  if (error) throw error;
}
