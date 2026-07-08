import { Link } from 'react-router-dom'
import Container from './Container'
import styles from './Footer.module.css'

const FOOTER_NAV = [
  { label: '시그니처', to: '/#signature' },
  { label: '메뉴', to: '/menu' },
  { label: '정기구독', to: '/subscribe' },
  { label: '소식', to: '/news' },
  { label: '이용안내', to: '/#guide' },
]

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <Container className={styles.inner}>
        <nav className={styles.nav}>
          {FOOTER_NAV.map((item) => (
            <Link key={item.label} to={item.to} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.divider} />

        <div className={styles.policy}>
          <span>이용약관</span>
          <span>개인정보처리방침</span>
        </div>

        <div className={styles.brandBlock}>
          <div className={styles.brandLine}>
            <span className={styles.brandKo}>까치커피바</span>
            <span className={styles.brandEn}>GGACHI COFFEE BAR</span>
          </div>
          <p className={styles.meta}>
            대전 유성구 대학로81번길 59 101호&nbsp;&nbsp;·&nbsp;&nbsp;전화 0507-1445-6303
          </p>
          <p className={styles.meta}>
            영업시간 월–토 08:00–20:00 · 일요일 12:00–20:00&nbsp;&nbsp;·&nbsp;&nbsp;Instagram @GGachi_coffeebar
          </p>
          <p className={styles.copyright}>© 2024 GGACHI COFFEE BAR. ALL RIGHTS RESERVED</p>
        </div>
      </Container>
    </footer>
  )
}
