import { Link, useLocation } from 'react-router-dom'
import Container from './Container'
import { handleHashNavClick } from './navItems'
import useApiData from '../hooks/useApiData'
import styles from './Footer.module.css'

const FOOTER_NAV = [
  { label: '시그니처', to: '/#signature' },
  { label: '메뉴', to: '/menu' },
  { label: '정기구독', to: '/subscribe' },
  { label: '소식', to: '/news' },
  { label: '이용안내', to: '/#guide' },
]

export default function Footer() {
  const { pathname } = useLocation()
  // 매장 정보는 store_info 가 원천입니다. 도착 전에는 해당 줄을 비워 둡니다.
  const { data: store } = useApiData('/api/store-info')

  return (
    <footer className={styles.footer}>
      <Container className={styles.inner}>
        <nav className={styles.nav}>
          {FOOTER_NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              onClick={(e) => handleHashNavClick(e, item.to, pathname)}
              className={styles.navLink}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.divider} />

        <div className={styles.policy}>
          <span>이용약관</span>
          <span>개인정보처리방침</span>
        </div>

        {store && (
          <div className={styles.brandBlock}>
            <div className={styles.brandLine}>
              <span className={styles.brandKo}>{store.brandNameKo}</span>
              <span className={styles.brandEn}>{store.brandNameEn}</span>
            </div>
            <p className={styles.meta}>
              {store.address}&nbsp;&nbsp;·&nbsp;&nbsp;전화 {store.phone}
            </p>
            <p className={styles.meta}>
              영업시간 {store.openingHours}&nbsp;&nbsp;·&nbsp;&nbsp;Instagram {store.instagram}
            </p>
            <p className={styles.copyright}>© 2024 {store.brandNameEn}. ALL RIGHTS RESERVED</p>
          </div>
        )}
      </Container>
    </footer>
  )
}
