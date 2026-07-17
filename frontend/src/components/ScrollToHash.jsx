import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// 해시(#signature 등)가 있는 경로로 이동했을 때 해당 섹션으로 부드럽게 스크롤합니다.
// react-router v6는 해시 스크롤을 기본 지원하지 않아 직접 처리합니다.
export default function ScrollToHash() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    // 섹션이 렌더링된 뒤 스크롤하도록 다음 프레임에서 실행
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(hash)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(id)
  }, [hash])

  return null
}
