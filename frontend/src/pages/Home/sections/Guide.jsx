import Container from '../../../components/Container'
import SectionHeading from '../../../components/SectionHeading'
import DataState from '../../../components/DataState'
import useApiData from '../../../hooks/useApiData'
import styles from './Guide.module.css'

// 디자인상 좌열 01·02·03 / 우열 04·05·06 순서로 배치됩니다.
// API 는 sort_order 순의 평평한 배열을 주므로, 앞 절반을 좌열·뒤 절반을 우열로 짝지어 행을 만듭니다.
function toRows(items) {
  const half = Math.ceil(items.length / 2)
  return Array.from({ length: half }, (_, i) => [items[i], items[i + half]])
}

function GuideItem({ item }) {
  // 항목 수가 홀수면 마지막 행의 우열이 비어 있습니다(자리만 차지).
  if (!item) return <div className={styles.item} />

  return (
    <div className={styles.item}>
      <div className={styles.icon} aria-hidden="true" />
      <div className={styles.itemText}>
        <p className={styles.no}>{item.no}</p>
        <p className={styles.itemTitle}>{item.title}</p>
        <p className={styles.itemDesc}>
          {item.body.map((line, i) => (
            <span key={i}>{line}{i < item.body.length - 1 && <br />}</span>
          ))}
        </p>
      </div>
    </div>
  )
}

export default function Guide() {
  const { data: items, loading, error } = useApiData('/api/guide', [])

  return (
    <section id="guide" className={styles.section}>
      <Container className={styles.inner}>
        <SectionHeading
          label="GUIDE"
          title={<>까치커피바 <span className="accent">이용안내</span></>}
          description="더 편안하고 즐거운 시간을 위해 이용 안내를 확인해주세요."
        />

        <DataState loading={loading} error={error} empty={items.length === 0}>
          <div className={styles.items}>
            <div className={styles.divider} />
            {toRows(items).map((row, i) => (
              <div key={i}>
                <div className={styles.row}>
                  <GuideItem item={row[0]} />
                  <GuideItem item={row[1]} />
                </div>
                <div className={styles.divider} />
              </div>
            ))}
          </div>
        </DataState>

        <div className={styles.note}>
          <div className={styles.noteIcon} aria-hidden="true" />
          <div className={styles.noteText}>
            <p className={styles.noteTitle}>이용 시 참고 부탁드립니다.</p>
            <p className={styles.noteDesc}>
              매장 내 모든 공간은 금연입니다. 쾌적한 환경 유지를 위해 모두의 배려 부탁드립니다. 문의 사항은 매장 직원에게 언제든지 말씀해주세요.
            </p>
          </div>
        </div>
      </Container>
    </section>
  )
}
