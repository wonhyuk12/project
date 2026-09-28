/** chisung42 프론트(choreohub.vercel.app, 별도 정적 배포)에서 이 백엔드(choreohub-api.vercel.app)의
 *  API 라우트를 크로스 오리진으로 호출할 수 있게 붙이는 CORS 헤더.
 *  인증이 필요한 라우트는 Authorization 헤더로 Supabase 세션을 넘기는 방식을 쓴다(쿠키는
 *  크로스 오리진에 기본적으로 안 실림) — 프론트 쪽 구현 시 함께 맞춰야 한다. */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.CORS_ALLOWED_ORIGIN ?? "https://choreohub.vercel.app",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
