// 백엔드 API 호출 헬퍼.
// dev 서버는 /api 요청을 Flask(:5000)로 프록시합니다. (vite.config.js)

// 같은 경로로 동시에 들어온 GET 은 하나로 합칩니다.
// Header/Footer 가 동시에 매장정보를 부르거나 StrictMode 가 effect 를 두 번 실행해도
// 실제 요청(과 소식 조회수 증가)은 한 번만 일어납니다.
const inflight = new Map()

export function apiGet(path) {
  const pending = inflight.get(path)
  if (pending) return pending

  const request = fetch(path, { headers: { Accept: 'application/json' } })
    .then(async (res) => {
      if (!res.ok) {
        // 백엔드는 실패 시 { error: '...' } 형태로 사유를 알려줍니다.
        const body = await res.json().catch(() => ({}))
        const error = new Error(body.error || `요청 실패 (${res.status})`)
        error.status = res.status
        throw error
      }
      return res.json()
    })
    .finally(() => inflight.delete(path))

  inflight.set(path, request)
  return request
}
