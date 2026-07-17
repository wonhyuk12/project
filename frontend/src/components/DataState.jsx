import styles from './DataState.module.css'

// 콘텐츠는 전부 DB(API)에서 옵니다. 프론트에 사본이 없으므로
// 로딩 / 실패 / 빈 상태를 화면에 그대로 드러냅니다.
//
// 세 상태 중 하나에 해당하면 안내 문구를, 아니면 children 을 렌더링합니다.
export default function DataState({ loading, error, empty, children }) {
  if (loading) return <p className={styles.state}>불러오는 중…</p>

  if (error) {
    return (
      <p className={`${styles.state} ${styles.error}`}>
        콘텐츠를 불러오지 못했습니다. {error.message}
      </p>
    )
  }

  if (empty) return <p className={styles.state}>등록된 내용이 없습니다.</p>

  return children
}
