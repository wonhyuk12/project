// 소식(공지) 데이터 — 목록 화면과 상세 화면이 공유합니다.
// (지금은 DB 없이 정적 데이터. 백엔드 연결 시 API 응답으로 대체 예정)
// 'body'(상세 본문)는 소식 상세 화면 작업 단계에서 채웁니다.
export const NEWS = [
  {
    id: 1,
    category: '공지',
    title: '쫀득한 까치 브라우니 출시',
    isNew: true,
    author: '까치커피바',
    date: '2024.06.08',
    views: 128,
    // 디자인에 있는 실제 본문 (그대로)
    body: [
      { type: 'p', text: '안녕하세요, 까치커피바입니다.' },
      { type: 'p', text: '매장에서 직접 만드는 수제 더블초코 브라우니가 새롭게 출시되었습니다. 꾸덕하고 진한 초콜릿의 풍미와 쫀득한 식감을 그대로 담아, 커피 한 잔과 함께 즐기기 좋은 디저트로 준비했습니다.' },
      { type: 'list', items: ['가격 : 4,500원', '판매 : 매장 한정 (소진 시 조기 마감될 수 있습니다)'] },
      { type: 'p', text: '갓 구운 브라우니의 매력을 매장에서 만나보세요. 따뜻한 커피와 함께 특별한 시간 보내시길 바랍니다.' },
      { type: 'p', muted: true, text: '— 까치커피바 드림' },
    ],
  },
  {
    id: 2,
    category: '공지',
    title: '까치커피바 키링 굿즈 출시',
    isNew: true,
    author: '까치커피바',
    date: '2024.06.05',
    views: 96,
    // 디자인에 상세 본문이 없어 placeholder — 실제 내용 확정 후 교체 필요
    body: [{ type: 'p', text: '(상세 내용 준비 중입니다.)' }],
  },
  {
    id: 3,
    category: '공지',
    title: '6월 매장 운영 안내',
    isNew: false,
    author: '까치커피바',
    date: '2024.05.28',
    views: 210,
    // 디자인에 상세 본문이 없어 placeholder — 실제 내용 확정 후 교체 필요
    body: [{ type: 'p', text: '(상세 내용 준비 중입니다.)' }],
  },
]

export const getNewsById = (id) => NEWS.find((n) => String(n.id) === String(id))
