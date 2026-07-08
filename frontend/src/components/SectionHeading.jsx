import styles from './SectionHeading.module.css'

// 섹션 상단 공통: 작은 라벨 + 큰 제목(일부 강조색) + 설명
// title은 문자열 또는 JSX(강조 span 포함) 모두 허용
export default function SectionHeading({ label, title, description }) {
  return (
    <div className={styles.heading}>
      <p className={styles.label}>{label}</p>
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  )
}
