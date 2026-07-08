import { Link, useLocation } from 'react-router-dom'
import Container from './Container'
import { NAV_ITEMS, PHONE } from './navItems'
import styles from './Header.module.css'

// variant: 'transparent' (홈 히어로 위 오버레이) | 'solid' (내부 페이지)
export default function Header({ variant = 'solid' }) {
  const { pathname } = useLocation()

  return (
    <header className={`${styles.header} ${styles[variant]}`}>
      <Container className={styles.inner}>
        <Link to="/" className={styles.logo}>까치커피바</Link>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            // 활성 표시: 해당 항목 경로가 현재 경로와 정확히 일치할 때 (해시 항목은 제외됨)
            const isActive = item.to === pathname
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <a href={`tel:${PHONE}`} className={styles.phone}>
          전화 주문 {PHONE}
        </a>
      </Container>
    </header>
  )
}
