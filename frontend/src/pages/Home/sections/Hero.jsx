import { Link } from 'react-router-dom'
import Header from '../../../components/Header'
import Container from '../../../components/Container'
import styles from './Hero.module.css'

const INFO_COLS = [
  { label: 'LOCATION', value: '대전 유성구 대학로81번길 59 101호' },
  { label: 'OPENING HOURS', value: '월–토 08:00–20:00 · 일요일 12:00–20:00' },
  { label: 'FOLLOW US', value: '@GGachi_coffeebar' },
]

export default function Hero() {
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
            {INFO_COLS.map((col) => (
              <div key={col.label} className={styles.infoCol}>
                <span className={styles.infoLabel}>{col.label}</span>
                <span className={styles.infoValue}>{col.value}</span>
              </div>
            ))}
          </div>
          <div className={styles.infoLinks}>
            <p>이용안내 | F&amp;A | 개인정보처리방침</p>
            <p>© 2024 GGACHI COFFEE BAR.</p>
          </div>
        </Container>
      </div>
    </section>
  )
}
