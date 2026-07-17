// DB 는 가격을 정수(원), 날짜를 ISO 문자열로 보냅니다. 표시 포맷은 화면 담당입니다.

export function formatWon(price) {
  if (price == null) return ''
  return `${price.toLocaleString('ko-KR')}원`
}

// '2024-06-08T00:00:00+00:00' → '2024.06.08'
export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}
