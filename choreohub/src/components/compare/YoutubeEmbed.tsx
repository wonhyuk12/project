export function YoutubeEmbed({
  videoId,
  startSec,
  title,
}: {
  videoId: string;
  startSec?: number;
  title: string;
}) {
  const start = startSec && startSec > 0 ? `?start=${Math.floor(startSec)}` : "";
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
      <iframe
        key={start}
        src={`https://www.youtube-nocookie.com/embed/${videoId}${start}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}
