import { Link } from 'react-router-dom'
import Container from '../../../components/Container'
import SectionHeading from '../../../components/SectionHeading'
import DataState from '../../../components/DataState'
import useApiData from '../../../hooks/useApiData'
import { formatDate } from '../../../utils/format'
import styles from './Notice.module.css'

// 홈에는 최신 3건만 노출합니다.
const CARD_COUNT = 3

export default function Notice() {
  const { data: news, loading, error } = useApiData('/api/news', [])

  return (
    <section id="notice" className={styles.section}>
      <Container className={styles.inner}>
        <SectionHeading
          label="NOTICE"
          title={<>까치커피바의 <span className="accent">소식</span></>}
          description="까치커피바의 새로운 소식과 이벤트 정보를 확인해보세요."
        />

        <DataState loading={loading} error={error} empty={news.length === 0}>
          <div className={styles.cards}>
            {news.slice(0, CARD_COUNT).map((item) => (
              <Link key={item.id} to={`/news/${item.id}`} className={styles.card}>
                <div
                  className={styles.image}
                  style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
                />
                <div className={styles.body}>
                  <div className={styles.metaRow}>
                    <span className={styles.date}>{formatDate(item.publishedAt)}</span>
                    {item.isNew && <span className={styles.new}>NEW</span>}
                  </div>
                  <h3 className={styles.title}>{item.title}</h3>
                  <p className={styles.desc}>{item.summary}</p>
                  <span className={styles.arrow}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </DataState>

        <Link to="/news" className={styles.more}>전체 소식 보기&nbsp;&nbsp;›</Link>
      </Container>
    </section>
  )
}
