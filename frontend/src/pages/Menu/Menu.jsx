import Header from '../../components/Header'
import Footer from '../../components/Footer'
import Container from '../../components/Container'
import PageHead from '../../components/PageHead'
import styles from './Menu.module.css'

// 좌열/우열로 나뉘는 카테고리 데이터 (디자인 기준)
const LEFT_COLUMN = [
  {
    en: 'COFFEE',
    ko: '커피',
    items: [
      { name: '아메리카노', price: '3,800원' },
      { name: '콜드브루 커피', note: '디카페인 변경 가능', price: '3,800원' },
      { name: '핸드드립 커피', price: '5,000원' },
      { name: '까치 콜드브루 원액 250ml', price: '6,000원' },
      { name: '410ml 아이스 아메리카노', badge: '대표', price: '1,200원' },
    ],
  },
  {
    en: 'LATTE',
    ko: '라떼',
    items: [
      { name: '카페라떼', price: '4,500원' },
      { name: '콜드브루 라떼', note: '디카페인 변경 가능', price: '4,400원' },
      { name: '까치라떼', badge: '대표', price: '5,500원' },
      { name: '더블초코라떼', price: '4,500원' },
      { name: '까치 마시멜로 모카', price: '5,500원' },
      { name: '410ml 카페라떼', price: '1,700원' },
    ],
  },
]

const RIGHT_COLUMN = [
  {
    en: 'SMOOTHIE',
    ko: '스무디',
    items: [
      { name: '오리지널 딸기 스무디', price: '6,000원' },
      { name: '오리지널 망고 스무디', price: '6,000원' },
      { name: '오리지널 블루베리 스무디', price: '6,000원' },
    ],
  },
  {
    en: 'DESSERT',
    ko: '디저트',
    items: [
      { name: '까치 마들렌', badge: '대표', note: '화이트 초코 + 다크 초코의 조합', price: '2,900원' },
      { name: '까치 브라우니', price: '4,500원' },
      { name: '망고 소르베', badge: '대표', price: '3,900원' },
      { name: '딸기 소르베', price: '3,900원' },
    ],
  },
]

function MenuCategory({ category }) {
  return (
    <div className={styles.category}>
      <div className={styles.catHead}>
        <span className={styles.catEn}>{category.en}</span>
        <span className={styles.catKo}>{category.ko}</span>
      </div>
      <div className={styles.catRule} />

      {category.items.map((item, i) => (
        <div key={item.name}>
          {i > 0 && <div className={styles.rowDivider} />}
          <div className={styles.row}>
            <div className={styles.rowInfo}>
              <div className={styles.nameRow}>
                <span className={styles.name}>{item.name}</span>
                {item.badge && <span className={styles.badge}>{item.badge}</span>}
              </div>
              {item.note && <span className={styles.note}>{item.note}</span>}
            </div>
            <span className={styles.price}>{item.price}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Menu() {
  return (
    <>
      <Header variant="solid" />
      <PageHead
        label="MENU"
        title={<>전체 <span className="accent">메뉴</span></>}
        description="까치커피바에서 판매 중인 전체 메뉴입니다."
        breadcrumb={['홈', '전체 메뉴']}
      />

      <Container className={styles.content}>
        <div className={styles.column}>
          {LEFT_COLUMN.map((cat) => <MenuCategory key={cat.en} category={cat} />)}
        </div>
        <div className={styles.column}>
          {RIGHT_COLUMN.map((cat) => <MenuCategory key={cat.en} category={cat} />)}
        </div>
      </Container>

      <Footer />
    </>
  )
}
