// 오프라인 캐싱은 하지 않는다(로그인·결제처럼 항상 최신 상태여야 하는 화면이 많아서
// 캐시로 인한 상태 불일치 위험이 더 크다) — fetch 핸들러 존재 자체가 브라우저의
// "설치 가능한 웹앱" 판정 조건이라 최소한으로만 등록해둔다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});
