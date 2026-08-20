import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS } from "@/lib/cors";

export interface YoutubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "검색어가 필요해요." }, { status: 400, headers: CORS_HEADERS });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 YOUTUBE_API_KEY가 설정되지 않았어요." },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", q);
  url.searchParams.set("type", "video");
  // 저작권 프리 결과만: 크리에이티브 커먼즈 라이선스 + 임베드 가능한 영상만
  url.searchParams.set("videoLicense", "creativeCommon");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("maxResults", "12");
  url.searchParams.set("key", apiKey);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    return NextResponse.json(
      { error: "유튜브 검색 요청에 실패했어요." },
      { status: 502, headers: CORS_HEADERS },
    );
  }

  if (!res.ok) {
    const body = await res.text();
    console.error("[youtube search] failed", res.status, body);
    return NextResponse.json(
      { error: "유튜브 검색 중 오류가 발생했어요." },
      { status: res.status === 403 ? 503 : 502, headers: CORS_HEADERS },
    );
  }

  const data = await res.json();
  const results: YoutubeSearchResult[] = (data.items ?? [])
    .filter((item: { id?: { videoId?: string } }) => item.id?.videoId)
    .map((item: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string }> } }) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl:
        item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? "",
    }));

  return NextResponse.json({ results }, { headers: CORS_HEADERS });
}
