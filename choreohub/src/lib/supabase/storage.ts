import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_TTL_SEC = 60 * 60 * 6; // 6시간 — 세션마다 hydrate 때 다시 발급받음

/** 비공개 videos 버킷에 {user_id}/{uuid}.{ext} 경로로 업로드하고 저장용 경로를 돌려준다.
 *  경로 첫 세그먼트가 user_id여야 storage RLS 정책(0001_init.sql)이 통과한다. */
export async function uploadVideo(
  supabase: SupabaseClient,
  userId: string,
  blob: Blob,
  ext: string,
): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("videos")
    .upload(path, blob, { contentType: blob.type || undefined });
  if (error) throw error;
  return path;
}

/** 비공개 버킷이라 재생하려면 매번 서명된 URL을 새로 받아야 한다. */
export async function getVideoUrl(supabase: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("videos")
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error || !data) throw error ?? new Error("영상 URL을 가져오지 못했어요.");
  return data.signedUrl;
}
