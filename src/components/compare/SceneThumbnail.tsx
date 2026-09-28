"use client";

import { useEffect, useState } from "react";

export function SceneThumbnail({
  videoUrl,
  time,
  label,
}: {
  videoUrl: string;
  time: number;
  label?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const video = document.createElement("video");
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    function capture() {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.width > 0 ? canvas.getContext("2d") : null;
      if (!ctx) {
        setFailed(true);
        return;
      }
      ctx.drawImage(video, 0, 0);
      setSrc(canvas.toDataURL("image/jpeg", 0.75));
    }

    function onLoadedMetadata() {
      const duration = video.duration || time;
      video.currentTime = Math.min(Math.max(time, 0), Math.max(duration - 0.05, 0));
    }
    function onSeeked() {
      capture();
    }
    function onError() {
      if (!cancelled) setFailed(true);
    }

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
  }, [videoUrl, time]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-black">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label ?? "영상 장면"} className="h-full w-full object-cover" />
      ) : failed ? (
        <div className="flex h-full items-center justify-center text-[10px] text-muted-2">
          미리보기 없음
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] text-muted-2">
          불러오는 중…
        </div>
      )}
      {label && (
        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] text-white">
          {label}
        </span>
      )}
    </div>
  );
}
