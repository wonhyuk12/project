import { Link } from 'react-router-dom'
import Container from '../../../components/Container'
import SectionHeading from '../../../components/SectionHeading'
import DataState from '../../../components/DataState'
import useApiData from '../../../hooks/useApiData'
import { formatWon } from '../../../utils/format'
import styles from './Signature.module.css'

export default function Signature() {
  // home_signatures — 홈 큐레이션. 가격은 FK 로 이어진 원본 메뉴(menu_items)에서 옵니다.
  const { data: items, loading, error } = useApiData('/api/signatures', [])

  return (
    <section id="signature" className={styles.section}>
      <Container className={styles.inner}>
        <SectionHeading
          label="SIGNATURE"
          title={<>까치커피바의 <span className="accent">시그니처 메뉴</span></>}
          description="정성스럽게 고르고, 매장에서 직접 만들어 까치커피만의 맛으로 준비합니다."
        />

        <DataState loading={loading} error={error} empty={items.length === 0}>
          <div className={styles.cards}>
            {items.map((item) => (
              <article key={item.id} className={styles.card}>
                <div
                  className={styles.image}
                  style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
                />
                <div className={styles.body}>
                  <p className={styles.no}>{item.no}</p>
                  <h3 className={styles.name}>{item.nameEn}</h3>
                  <p className={styles.desc}>
                    {item.tagline.map((line, i) => (
                      <span key={i}>{line}<br /></span>
                    ))}
                  </p>
                  <p className={styles.price}>{formatWon(item.price)}</p>
                </div>
              </article>
            ))}
          </div>
        </DataState>

        <Link to="/menu" className={styles.more}>전체 메뉴 보기&nbsp;&nbsp;›</Link>
      </Container>
    </section>
  )
}
