"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/client";
import { getVideoUrl } from "@/lib/supabase/storage";
import { fetchProfileNames, displayName, type ProfileNameInfo } from "@/lib/profiles";
import {
  fetchLikeState,
  toggleLike,
  requestAccess,
  fetchMyAccessRequests,
  type AccessStatus,
} from "@/lib/community/api";

interface PublicProject {
  id: string;
  title: string;
  songName: string;
  description: string;
  thumbnailColor: string;
  updatedAt: string;
  ownerId: string;
}

interface PublicVersion {
  id: string;
  label: string;
  videoUrl: string;
  createdAt: string;
}

const STATUS_LABEL: Record<AccessStatus, string> = { 대기: "대기중", 승인: "승인됨", 거절: "거절됨" };

/** 소유자·멤버가 아닌 방문자가 전체공개 프로젝트를 볼 때 쓰는 읽기전용 화면.
 *  useProjectStore는 이제 "내 프로젝트"만 담고 있어서(공개 피드 누출 방지 수정) 여기선
 *  supabase에서 직접 읽어온다 — 편집/제안/멤버관리 등 쓰기 액션은 아예 안 보여준다. */
export function PublicProjectView({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<PublicProject | null | undefined>(undefined);
  const [versions, setVersions] = useState<PublicVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<ProfileNameInfo | undefined>(undefined);
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [myRequests, setMyRequests] = useState<Record<string, AccessStatus | null>>({});
  const [requesting, setRequesting] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();

      const { data: projectRow } = await supabase
        .from("projects")
        .select("id, title, song_name, description, thumbnail_color, updated_at, user_id, is_public")
        .eq("id", projectId)
        .maybeSingle();

      if (cancelled) return;
      if (!projectRow || !projectRow.is_public) {
        setProject(null);
        return;
      }
      setProject({
        id: projectRow.id,
        title: projectRow.title,
        songName: projectRow.song_name,
        description: projectRow.description ?? "",
        thumbnailColor: projectRow.thumbnail_color,
        updatedAt: (projectRow.updated_at as string).slice(0, 10),
        ownerId: projectRow.user_id,
      });

      const [{ data: versionRows }, names, like, requests] = await Promise.all([
        supabase
          .from("versions")
          .select("id, label, video_path, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        fetchProfileNames(supabase, [projectRow.user_id]),
        fetchLikeState(supabase, projectId),
        fetchMyAccessRequests(supabase, projectId),
      ]);
      if (cancelled) return;

      const resolvedVersions = await Promise.all(
        (versionRows ?? []).map(async (v) => {
          try {
            const videoUrl = await getVideoUrl(supabase, v.video_path as string);
            return { id: v.id as string, label: v.label as string, videoUrl, createdAt: (v.created_at as string).slice(0, 10) };
          } catch {
            return { id: v.id as string, label: v.label as string, videoUrl: "", createdAt: (v.created_at as string).slice(0, 10) };
          }
        }),
      );
      if (cancelled) return;

      setVersions(resolvedVersions);
      setSelectedVersionId(resolvedVersions[0]?.id ?? null);
      setOwnerName(names.get(projectRow.user_id));
      setLikeCount(like.count);
      setLikedByMe(like.likedByMe);
      setMyRequests(requests);
      if (requests["다운로드"] === "승인") {
        setDownloadUrl(resolvedVersions[0]?.videoUrl ?? null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleToggleLike() {
    const supabase = createClient();
    const prevLiked = likedByMe;
    setLikedByMe(!prevLiked);
    setLikeCount((c) => c + (prevLiked ? -1 : 1));
    try {
      await toggleLike(supabase, projectId, prevLiked);
    } catch {
      setLikedByMe(prevLiked);
      setLikeCount((c) => c + (prevLiked ? 1 : -1));
    }
  }

  async function handleRequest(type: "다운로드" | "사용") {
    setRequesting(type);
    try {
      const supabase = createClient();
      await requestAccess(supabase, projectId, type);
      setMyRequests((prev) => ({ ...prev, [type]: "대기" }));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "요청에 실패했어요.");
    } finally {
      setRequesting(null);
    }
  }

  if (project === undefined) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="프로젝트" backHref="/community" />
        <p className="px-4 pt-10 text-center text-sm text-muted">불러오는 중…</p>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
        <TopBar title="프로젝트" backHref="/community" />
        <p className="px-4 pt-10 text-center text-sm text-muted">
          프로젝트를 찾을 수 없거나 비공개예요.
        </p>
      </div>
    );
  }

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0];

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x">
      <TopBar title={project.title} backHref="/community" />

      <div className="mx-4">
        {selectedVersion?.videoUrl ? (
          <video
            key={selectedVersion.id}
            src={selectedVersion.videoUrl}
            controls
            controlsList="nodownload"
            playsInline
            className="aspect-video w-full rounded-2xl border border-border bg-black object-cover"
          />
        ) : (
          <div className={`h-32 rounded-2xl bg-gradient-to-br ${project.thumbnailColor}`} />
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 py-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            {displayName(ownerName)} · {project.updatedAt}
          </p>
          <button
            type="button"
            onClick={handleToggleLike}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted transition-colors hover:bg-surface-hover"
          >
            <span className={likedByMe ? "text-red-400" : ""}>{likedByMe ? "❤️" : "🤍"}</span>
            {likeCount}
          </button>
        </div>

        <div>
          <p className="text-sm text-foreground">{project.songName}</p>
        </div>

        {project.description && (
          <p className="text-sm leading-relaxed text-muted">{project.description}</p>
        )}

        {versions.length > 1 && (
          <div>
            <h2 className="mb-1.5 text-sm font-medium text-foreground">버전</h2>
            <div className="flex flex-col gap-1.5">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersionId(v.id)}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    v.id === selectedVersion?.id
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border bg-surface text-muted hover:bg-surface-hover"
                  }`}
                >
                  {v.label}
                  <span className="text-xs text-muted-2">{v.createdAt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2 flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-muted">
            이 화면은 읽기 전용이에요 — 수정·비교·제안 기능은 멤버만 쓸 수 있어요.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleRequest("다운로드")}
              disabled={requesting === "다운로드" || myRequests["다운로드"] != null}
              className="flex-1 rounded-lg border border-border bg-background py-2 text-xs text-muted transition-colors hover:bg-surface-hover disabled:opacity-60"
            >
              {myRequests["다운로드"] ? STATUS_LABEL[myRequests["다운로드"]] : "다운로드 요청"}
            </button>
            <button
              type="button"
              onClick={() => handleRequest("사용")}
              disabled={requesting === "사용" || myRequests["사용"] != null}
              className="flex-1 rounded-lg border border-border bg-background py-2 text-xs text-muted transition-colors hover:bg-surface-hover disabled:opacity-60"
            >
              {myRequests["사용"] ? STATUS_LABEL[myRequests["사용"]] : "사용 허가 요청"}
            </button>
          </div>
          {downloadUrl && (
            <a
              href={downloadUrl}
              download
              className="rounded-lg bg-accent py-2 text-center text-xs font-medium text-white transition-colors hover:bg-accent-light"
            >
              ⬇ 승인된 영상 다운로드
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
