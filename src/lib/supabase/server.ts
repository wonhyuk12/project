import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server Components / Route Handlers 전용. 요청마다 새로 만들어야 한다(클라이언트를
 *  재사용하면 안 됨) — @supabase/ssr 문서 권장 패턴 그대로. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 호출되면 쿠키를 못 쓴다 — 미들웨어가 세션 갱신을
            // 대신 처리하므로 무시해도 된다(@supabase/ssr 권장 패턴).
          }
        },
      },
    },
  );
}
