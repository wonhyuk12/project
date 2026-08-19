import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

// 영상 업로드(용량 큼) + Gemini Files API 폴링이 있어서 Node 런타임이 필요하다.
export const runtime = "nodejs";
export const maxDuration = 120;

const ADVICE_JSON_SCHEMA = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start: { type: "number" },
          end: { type: "number" },
          whatsWrong: { type: "string" },
          why: { type: "string" },
          howToFix: { type: "string" },
        },
        required: ["start", "end", "whatsWrong", "why", "howToFix"],
      },
    },
    overallComment: { type: "string" },
  },
  required: ["segments", "overallComment"],
};

interface SegmentInput {
  label?: string;
  start: number;
  end: number;
  score?: number;
  worstJoints?: { joint: string; avgDiffDeg: number }[];
}

interface RangeInput {
  start: number;
  end: number;
}

function parseRange(raw: FormDataEntryValue | null): RangeInput | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.start === "number" && typeof parsed?.end === "number") return parsed;
  } catch {
    // 파싱 실패 시 트리밍 없이 전체 영상 사용
  }
  return null;
}

function toOffsetMetadata(range: RangeInput | null) {
  if (!range) return { fps: 4 };
  return {
    fps: 4,
    startOffset: `${Math.max(0, Math.floor(range.start))}s`,
    endOffset: `${Math.ceil(range.end)}s`,
  };
}

async function uploadAndWaitActive(ai: GoogleGenAI, blob: Blob, mimeType: string) {
  let file = await ai.files.upload({ file: blob, config: { mimeType } });
  const startedAt = Date.now();
  while (file.state === "PROCESSING") {
    if (Date.now() - startedAt > 90000) {
      throw new Error("영상 처리 시간이 너무 오래 걸려요. 잠시 후 다시 시도해주세요.");
    }
    await new Promise((r) => setTimeout(r, 2000));
    if (!file.name) throw new Error("업로드된 파일 정보를 찾을 수 없어요.");
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE" || !file.uri || !file.mimeType) {
    throw new Error("영상 처리에 실패했어요. 다른 영상으로 시도해주세요.");
  }
  return file;
}

function buildNumericPrompt(segments: SegmentInput[]): string {
  const lines = segments
    .map((s, i) => {
      const joints =
        (s.worstJoints ?? []).map((j) => `${j.joint}(${j.avgDiffDeg}도 차이)`).join(", ") ||
        "특별히 두드러지는 관절 없음";
      return `${i + 1}. "${s.label ?? "구간"}" (${s.start.toFixed(1)}초~${s.end.toFixed(1)}초): 일치율 ${s.score ?? "?"}%, 차이가 큰 관절: ${joints}`;
    })
    .join("\n");

  return `당신은 댄스 안무 코치입니다. 첫 번째 영상은 사용자 영상이고, 두 번째는 레퍼런스 영상입니다. 아래는 두 영상의 포즈를 분석해서 이미 정확하게 계산해 둔 결과입니다.

${lines}

중요: 위 수치(퍼센트, 각도 차이)는 이미 정확히 계산되어 있습니다. 새로 추정하거나 다른 숫자를 만들어내지 마세요. 이 수치를 근거로 삼되, 실제로 두 영상을 보고 무엇이 다른지, 왜 그런 차이가 나는지, 어떻게 고치면 좋을지 한국어로 자연스럽게 설명하세요.

각 구간에 대해 위에 적힌 것과 정확히 같은 start/end 시간(초 단위 숫자)을 그대로 사용해서 whatsWrong(무엇이 다른지), why(그 동작에서 왜 그런 차이가 나는지), howToFix(구체적인 교정 방법)를 작성하고, overallComment에 전체 총평을 3문장 이내 한국어로 작성하세요.`;
}

function buildDescriptivePrompt(refTitle: string): string {
  return `당신은 댄스 안무 코치입니다. 첫 번째 영상은 사용자가 춤춘 영상이고, 두 번째는 유튜브 레퍼런스 영상("${refTitle}")입니다.

중요: 이 비교는 포즈 인식 데이터가 없어서 정확한 퍼센트나 관절 각도를 계산할 방법이 전혀 없습니다. 퍼센트, 점수, 각도 등 어떤 숫자도 절대 지어내지 마세요. 오직 두 영상을 직접 보고 관찰한 차이만 말로 서술하세요.

사용자 영상 타임라인 기준으로 눈에 띄게 다른 구간들을 찾아서, 각각 whatsWrong(무엇이 다른지), why(왜 그런 차이가 나는 것 같은지), howToFix(교정 방법)를 한국어로 서술하고, overallComment에 전체 총평을 3문장 이내로 작성하세요.`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 GEMINI_API_KEY가 설정되지 않았어요." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, pro_expires_at")
    .eq("id", user.id)
    .single();
  const isActivePro =
    profile?.plan === "pro" &&
    !!profile.pro_expires_at &&
    new Date(profile.pro_expires_at).getTime() > Date.now();
  if (!isActivePro) {
    return NextResponse.json(
      { error: "AI 조언은 Pro 전용 기능이에요." },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const mode = formData.get("mode");
  const userVideo = formData.get("userVideo");
  const segmentsRaw = formData.get("segments");

  if (!(userVideo instanceof Blob) || typeof segmentsRaw !== "string") {
    return NextResponse.json({ error: "필수 데이터가 빠졌어요." }, { status: 400 });
  }

  let segments: SegmentInput[];
  try {
    segments = JSON.parse(segmentsRaw);
  } catch {
    return NextResponse.json({ error: "구간 정보를 읽지 못했어요." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const userFile = await uploadAndWaitActive(ai, userVideo, userVideo.type || "video/mp4");
    const parts: Array<Record<string, unknown>> = [];

    if (mode === "descriptive") {
      const refYoutubeUrl = formData.get("refYoutubeUrl");
      const refTitle = formData.get("refTitle");
      if (typeof refYoutubeUrl !== "string") {
        return NextResponse.json({ error: "레퍼런스 유튜브 URL이 없어요." }, { status: 400 });
      }
      parts.push({
        text: buildDescriptivePrompt(typeof refTitle === "string" ? refTitle : "레퍼런스 영상"),
      });
      parts.push({
        fileData: { fileUri: userFile.uri, mimeType: userFile.mimeType },
        videoMetadata: { fps: 4 },
      });
      parts.push({ fileData: { fileUri: refYoutubeUrl }, videoMetadata: { fps: 4 } });
    } else {
      const refVideo = formData.get("refVideo");
      if (!(refVideo instanceof Blob)) {
        return NextResponse.json({ error: "레퍼런스 영상이 없어요." }, { status: 400 });
      }
      const refFile = await uploadAndWaitActive(ai, refVideo, refVideo.type || "video/mp4");
      const userRange = parseRange(formData.get("userRange"));
      const refRange = parseRange(formData.get("refRange"));
      parts.push({ text: buildNumericPrompt(segments) });
      parts.push({
        fileData: { fileUri: userFile.uri, mimeType: userFile.mimeType },
        videoMetadata: toOffsetMetadata(userRange),
      });
      parts.push({
        fileData: { fileUri: refFile.uri, mimeType: refFile.mimeType },
        videoMetadata: toOffsetMetadata(refRange),
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: ADVICE_JSON_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Gemini 응답이 비어있어요.");
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[compare/advice] failed", err);
    const message = err instanceof Error ? err.message : "AI 조언 생성에 실패했어요.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
