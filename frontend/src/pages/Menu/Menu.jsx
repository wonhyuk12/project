import Header from '../../components/Header'
import Footer from '../../components/Footer'
import Container from '../../components/Container'
import PageHead from '../../components/PageHead'
import DataState from '../../components/DataState'
import useApiData from '../../hooks/useApiData'
import { formatWon } from '../../utils/format'
import styles from './Menu.module.css'

function MenuCategory({ category }) {
  return (
    <div className={styles.category}>
      <div className={styles.catHead}>
        <span className={styles.catEn}>{category.nameEn}</span>
        <span className={styles.catKo}>{category.nameKo}</span>
      </div>
      <div className={styles.catRule} />

      {category.items.map((item, i) => (
        <div key={item.id}>
          {i > 0 && <div className={styles.rowDivider} />}
          <div className={styles.row}>
            <div className={styles.rowInfo}>
              <div className={styles.nameRow}>
                <span className={styles.name}>{item.name}</span>
                {item.isRepresentative && <span className={styles.badge}>대표</span>}
              </div>
              {item.note && <span className={styles.note}>{item.note}</span>}
            </div>
            <span className={styles.price}>{formatWon(item.price)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Menu() {
  const { data: categories, loading, error } = useApiData('/api/menu', [])

  // 디자인은 2열 메뉴판 — API 의 정렬 순서대로 앞 절반을 좌열, 뒤 절반을 우열에 둡니다.
  const half = Math.ceil(categories.length / 2)
  const leftColumn = categories.slice(0, half)
  const rightColumn = categories.slice(half)

  return (
    <>
      <Header variant="solid" />
      <PageHead
        label="MENU"
        title={<>전체 <span className="accent">메뉴</span></>}
        description="까치커피바에서 판매 중인 전체 메뉴입니다."
        breadcrumb={['홈', '전체 메뉴']}
      />

      <DataState loading={loading} error={error} empty={categories.length === 0}>
        <Container className={styles.content}>
          <div className={styles.column}>
            {leftColumn.map((cat) => <MenuCategory key={cat.id} category={cat} />)}
          </div>
          <div className={styles.column}>
            {rightColumn.map((cat) => <MenuCategory key={cat.id} category={cat} />)}
          </div>
        </Container>
      </DataState>

      <Footer />
    </>
  )
}
