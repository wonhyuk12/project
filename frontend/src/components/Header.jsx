import { Link, useLocation } from 'react-router-dom'
import Container from './Container'
import { NAV_ITEMS, handleHashNavClick } from './navItems'
import useApiData from '../hooks/useApiData'
import styles from './Header.module.css'

// variant: 'transparent' (홈 히어로 위 오버레이) | 'solid' (내부 페이지)
export default function Header({ variant = 'solid' }) {
  const { pathname } = useLocation()
  // 상호·전화번호는 store_info 가 원천입니다. 도착 전에는 비워 둡니다.
  const { data: store } = useApiData('/api/store-info')

  return (
    <header className={`${styles.header} ${styles[variant]}`}>
      <Container className={styles.inner}>
        <Link to="/" className={styles.logo}>{store?.brandNameKo}</Link>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            // 활성 표시: 해당 항목 경로가 현재 경로와 정확히 일치할 때 (해시 항목은 제외됨)
            const isActive = item.to === pathname
            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={(e) => handleHashNavClick(e, item.to, pathname)}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* 전화번호가 도착하기 전에도 자리는 유지해 레이아웃이 흔들리지 않게 합니다. */}
        {store?.phone ? (
          <a href={`tel:${store.phone}`} className={styles.phone}>
            전화 주문 {store.phone}
          </a>
        ) : (
          <span className={styles.phone} />
        )}
      </Container>
    </header>
  )
}
