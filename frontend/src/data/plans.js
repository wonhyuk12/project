// 정기구독 플랜 데이터 — 홈 정기구독 섹션과 신청(Checkout) 화면이 공유합니다.
export const PLANS = [
  {
    id: '10',
    name: '10일권',
    was: '12,000원',
    price: '10,000원',
    priceValue: 10000,
    desc: ['아메리카노 410ML 매일 1잔', '결제일부터 10일'],
    badge: 'BEST',
  },
  {
    id: '20',
    name: '20일권',
    was: '24,000원',
    price: '19,900원',
    priceValue: 19900,
    desc: ['아메리카노 410ML 매일 1잔', '결제일부터 20일'],
  },
  {
    id: '30',
    name: '30일권',
    was: '36,000원',
    price: '29,700원',
    priceValue: 29700,
    desc: ['아메리카노 410ML 매일 1잔', '결제일부터 30일'],
    badge: '하루 990원',
  },
]

export const getPlanById = (id) => PLANS.find((p) => p.id === id)
