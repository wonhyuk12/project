// 헤더/푸터 공통 내비게이션 항목
// 참고: '시그니처'와 '이용안내'는 홈 화면 내 섹션 앵커로 연결했습니다.
// (별도 페이지가 아니므로 홈의 해당 섹션으로 스크롤되도록 해시 링크 사용)
export const NAV_ITEMS = [
  { label: '홈', to: '/' },
  { label: '시그니처', to: '/#signature' },
  { label: '메뉴', to: '/menu' },
  { label: '정기구독', to: '/subscribe' },
  { label: '소식', to: '/news' },
  { label: '이용안내', to: '/#guide' },
]

// 해시 링크(예: /#signature) 클릭 처리 공통 헬퍼.
// 이미 대상 페이지에 있으면 해시가 바뀌지 않아 라우터가 아무 동작도 하지 않으므로,
// 여기서 직접 해당 섹션으로 스크롤해 누를 때마다 이동되도록 합니다.
export function handleHashNavClick(e, to, pathname) {
  const hashIndex = to.indexOf('#')
  if (hashIndex === -1) return // 일반 링크는 그대로 이동

  const targetPath = to.slice(0, hashIndex) || '/'
  const hash = to.slice(hashIndex)

  if (pathname === targetPath) {
    const el = document.querySelector(hash)
    if (el) {
      e.preventDefault()
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
  // 다른 페이지에 있으면 기본 동작으로 이동하고 ScrollToHash가 스크롤 처리
}
