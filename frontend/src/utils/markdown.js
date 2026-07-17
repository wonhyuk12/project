// 소식 본문(news.body)은 Markdown(TEXT)으로 저장됩니다.
// 실제로 쓰는 문법이 '빈 줄로 나뉜 문단'과 '- 목록' 뿐이라 별도 라이브러리 없이 파싱합니다.
// 그 이상(제목/링크/강조)이 필요해지면 react-markdown 도입을 검토하세요.
//
// 반환: [{ type: 'p', text, muted }] | [{ type: 'list', items: [...] }]

export function parseNewsBody(markdown) {
  const blocks = []

  for (const chunk of (markdown || '').split(/\n\s*\n/)) {
    const lines = chunk
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) continue

    if (lines.every((line) => line.startsWith('- '))) {
      blocks.push({ type: 'list', items: lines.map((line) => line.slice(2).trim()) })
      continue
    }

    const text = lines.join(' ')
    // '— 까치커피바 드림' 같은 맺음말은 디자인상 흐린 색으로 표시합니다.
    blocks.push({ type: 'p', text, muted: text.startsWith('—') })
  }

  return blocks
}
