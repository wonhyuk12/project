import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProfileNameInfo {
  name: string | null;
  email: string | null;
}

/** user_id 목록으로 표시용 이름/이메일을 한 번에 가져온다 — "누가 만들었는지" 같은
 *  attribution 표시에 재사용한다. */
export async function fetchProfileNames(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, ProfileNameInfo>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const { data } = await supabase.from("profiles").select("id, name, email").in("id", uniqueIds);

  return new Map(
    (data ?? []).map((p) => [
      p.id as string,
      { name: (p.name as string | null) ?? null, email: (p.email as string | null) ?? null },
    ]),
  );
}

export function displayName(info: ProfileNameInfo | undefined, fallback = "알 수 없음"): string {
  if (!info) return fallback;
  return info.name || info.email || fallback;
}
