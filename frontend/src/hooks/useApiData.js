import { useEffect, useState } from 'react'
import { apiGet } from '../api/client'

// 콘텐츠의 원천은 DB(API) 하나뿐입니다. 프론트에 사본/더미 데이터를 두지 않으므로
// 로딩·실패 상태는 화면에서 처리합니다. (components/DataState.jsx)
//
// initial: 첫 렌더에 쓸 빈 값 — 목록이면 [], 단일 객체면 null.
export default function useApiData(path, initial = null) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)

    apiGet(path)
      .then((result) => {
        if (alive) setData(result)
      })
      .catch((err) => {
        if (alive) setError(err)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [path])

  return { data, loading, error }
}
