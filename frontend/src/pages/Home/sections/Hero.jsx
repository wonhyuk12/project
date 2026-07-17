import { Link } from 'react-router-dom'
import Header from '../../../components/Header'
import Container from '../../../components/Container'
import useApiData from '../../../hooks/useApiData'
import styles from './Hero.module.css'

export default function Hero() {
  // 정보바도 store_info 가 원천입니다(헤더·푸터와 동일 소스).
  const { data: store } = useApiData('/api/store-info')

  const infoCols = [
    { label: 'LOCATION', value: store?.address },
    { label: 'OPENING HOURS', value: store?.openingHours },
    { label: 'FOLLOW US', value: store?.instagram },
  ]

  return (
    <section className={styles.hero}>
      <Header variant="transparent" />

      <Container>
        <div className={styles.content}>
          <h1 className={styles.title}>
            GGACHI<br />COFFEE BAR
          </h1>
          <p className={styles.subtitle}>매일 한 잔의 여유, 까치커피바</p>
          <div className={styles.buttons}>
            <Link to="/menu" className={styles.btn}>메뉴 보기</Link>
            <Link to="/subscribe" className={styles.btn}>정기구독 보기</Link>
          </div>
        </div>
      </Container>

      <div className={styles.infoBar}>
        <Container className={styles.infoInner}>
          <div className={styles.infoCols}>
            {infoCols.map((col) => (
              <div key={col.label} className={styles.infoCol}>
                <span className={styles.infoLabel}>{col.label}</span>
                <span className={styles.infoValue}>{col.value}</span>
              </div>
            ))}
          </div>
          <div className={styles.infoLinks}>
            <p>이용안내 | F&amp;A | 개인정보처리방침</p>
            <p>© 2024 {store?.brandNameEn}.</p>
          </div>
        </Container>
      </div>
    </section>
  )
}
