import styles from './Container.module.css'

// 페이지 콘텐츠 폭 래퍼: 최대 1440px, 좌우 50px 패딩 (디자인의 콘텐츠 폭 1340px 재현)
export default function Container({ children, className = '' }) {
  return <div className={`${styles.container} ${className}`}>{children}</div>
}
