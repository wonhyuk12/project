"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/client";
import { fetchProfileNames, displayName, type ProfileNameInfo } from "@/lib/profiles";
import { fetchPublicFeed, toggleLike, type CommunityProject } from "@/lib/community/api";

export default function CommunityPage() {
  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [names, setNames] = useState<Map<string, ProfileNameInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      try {
        const feed = await fetchPublicFeed(supabase);
        if (cancelled) return;
        setProjects(feed);
        const nameMap = await fetchProfileNames(
          supabase,
          feed.map((p) => p.ownerId),
        );
        if (!cancelled) setNames(nameMap);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : "불러오지 못했어요.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggleLike(project: CommunityProject) {
    const supabase = createClient();
    // 낙관적 업데이트 — 실패하면 되돌린다.
    setProjects((prev) =>
      prev.map((p) =>
        p.id === project.id
          ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
          : p,
      ),
    );
    try {
      await toggleLike(supabase, project.id, project.likedByMe);
    } catch {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id
            ? { ...p, likedByMe: project.likedByMe, likeCount: project.likeCount }
            : p,
        ),
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x md:max-w-5xl md:border-x-0">
      <div className="md:hidden">
        <TopBar title="커뮤니티" backHref="/dashboard" />
      </div>

      <div className="flex-1 px-4 pb-8 pt-4 md:px-8">
        <p className="mb-3 text-xs text-muted">전체공개로 설정된 프로젝트들이에요.</p>

        {loading ? (
          <p className="pt-10 text-center text-sm text-muted">불러오는 중…</p>
        ) : errorMessage ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            {errorMessage}
          </p>
        ) : projects.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted">
            아직 전체공개로 올라온 프로젝트가 없어요.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:bg-surface-hover"
              >
                <Link href={`/projects/${p.id}`}>
                  <div className={`h-24 w-full bg-gradient-to-br ${p.thumbnailColor}`} />
                  <div className="flex flex-col gap-1.5 p-3">
                    <h3 className="text-sm font-medium leading-snug text-foreground">
                      {p.title}
                    </h3>
                    <p className="text-xs text-muted">{p.songName}</p>
                    <p className="text-[11px] text-muted-2">
                      {displayName(names.get(p.ownerId))} · {p.updatedAt}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => handleToggleLike(p)}
                  className="flex w-full items-center gap-1.5 border-t border-border/60 px-3 py-2 text-xs text-muted transition-colors hover:bg-surface-hover"
                >
                  <span className={p.likedByMe ? "text-red-400" : ""}>
                    {p.likedByMe ? "❤️" : "🤍"}
                  </span>
                  {p.likeCount}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
