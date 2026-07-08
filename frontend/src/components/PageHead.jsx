import Container from './Container'
import styles from './PageHead.module.css'

// 내부 페이지 상단 헤더 블록 (라벨 + 제목 + 설명 + 브레드크럼)
// breadcrumb: 문자열 배열, 예) ['홈', '전체 메뉴']
export default function PageHead({ label, title, description, breadcrumb }) {
  return (
    <div className={styles.pageHead}>
      <Container className={styles.inner}>
        <p className={styles.label}>{label}</p>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
        {breadcrumb && (
          <p className={styles.breadcrumb}>{breadcrumb.join('   ›   ')}</p>
        )}
      </Container>
    </div>
  )
}
