"use client";

import { useState } from "react";
import type { YoutubeSearchResult } from "@/app/api/youtube/search/route";
import { YoutubeEmbed } from "./YoutubeEmbed";
import { SkeletonOverlayPlayer } from "@/components/viewer/SkeletonOverlayPlayer";
import type { Version } from "@/lib/types";

interface Props {
  userVersion: Version;
  onSelect: (video: YoutubeSearchResult) => void;
}

type Status = "idle" | "loading" | "done" | "error";

export function YoutubeTab({ userVersion, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<YoutubeSearchResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<YoutubeSearchResult | null>(null);

  async function search() {
    if (!query.trim()) return;
    setStatus("loading");
    setErrorMessage(null);
    setPreview(null);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "검색에 실패했어요.");
      setResults(data.results ?? []);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "검색에 실패했어요.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg bg-accent/10 px-3 py-2 text-[11px] text-accent-light">
        라이선스 표시는 업로더가 설정한 값이며 음원 권리는 별개일 수 있습니다.
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="곡명 또는 안무명 검색"
          className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
        <button
          onClick={search}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light"
        >
          검색
        </button>
      </div>

      {status === "loading" && (
        <p className="text-center text-xs text-muted">검색 중…</p>
      )}

      {status === "error" && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
          {errorMessage}
        </p>
      )}

      {status === "done" && results.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-center text-xs text-muted">
          크리에이티브 커먼즈 라이선스 검색 결과가 없어요. &quot;내 아카이브&quot;나
          &quot;직접 업로드&quot; 경로를 이용해보세요.
        </p>
      )}

      {preview && (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-surface p-3">
          <p className="text-xs text-muted">내 영상과 비교해보고 고르세요</p>
          <div>
            <p className="mb-1 text-[11px] text-muted-2">내 영상</p>
            <SkeletonOverlayPlayer version={userVersion} />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-2">레퍼런스 미리보기</p>
            <YoutubeEmbed videoId={preview.videoId} title={preview.title} />
          </div>
          <p className="text-xs font-medium text-foreground">{preview.title}</p>
          <p className="text-[10px] text-muted-2">{preview.channelTitle}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPreview(null)}
              className="flex-1 rounded-lg border border-border bg-surface py-2 text-xs text-muted transition-colors hover:bg-surface-hover"
            >
              다른 영상 보기
            </button>
            <button
              onClick={() => onSelect(preview)}
              className="flex-1 rounded-lg bg-accent py-2 text-xs font-medium text-white transition-colors hover:bg-accent-light"
            >
              이 영상 선택
            </button>
          </div>
        </div>
      )}

      {!preview && results.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {results.map((v) => (
            <button
              key={v.videoId}
              onClick={() => setPreview(v)}
              className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-2 text-left transition-colors hover:bg-surface-hover"
            >
              {v.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnailUrl} alt="" className="w-full rounded-lg" />
              )}
              <span className="inline-flex w-fit items-center rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent-light">
                CC 라이선스
              </span>
              <p className="line-clamp-2 text-xs text-foreground">{v.title}</p>
              <p className="text-[10px] text-muted-2">{v.channelTitle}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
