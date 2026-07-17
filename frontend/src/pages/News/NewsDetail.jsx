import { useParams, Link } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import PageHead from '../../components/PageHead'
import DataState from '../../components/DataState'
import useApiData from '../../hooks/useApiData'
import { formatDate } from '../../utils/format'
import { parseNewsBody } from '../../utils/markdown'
import styles from './NewsDetail.module.css'

export default function NewsDetail() {
  const { id } = useParams()
  // 이 요청이 서버에서 조회수(news.views)를 1 증가시킵니다.
  const { data: news, loading, error } = useApiData(`/api/news/${id}`)

  // 없는 글(404)은 실패가 아니라 정상적인 화면이므로 따로 처리합니다.
  const notFound = error?.status === 404

  return (
    <>
      <Header variant="solid" />
      <PageHead
        label="NOTICE"
        title={<>까치커피바의 <span className="accent">소식</span></>}
        breadcrumb={['홈', '소식', '상세']}
      />

      <div className={styles.wrap}>
        {notFound ? (
          <div className={styles.detail}>
            <p className={styles.notFound}>존재하지 않는 글입니다.</p>
            <div className={styles.footerRow}>
              <Link to="/news" className={styles.listBtn}>목록으로</Link>
            </div>
          </div>
        ) : (
          <DataState loading={loading} error={error} empty={!news}>
            <article className={styles.detail}>
              {/* 글 머리 */}
              <header className={styles.head}>
                <span className={styles.catBadge}>{news?.category}</span>
                <h2 className={styles.title}>{news?.title}</h2>
                <div className={styles.meta}>
                  <span>작성자 {news?.author}</span>
                  <span>작성일 {formatDate(news?.publishedAt)}</span>
                  <span>조회 {news?.views}</span>
                </div>
                <div className={styles.divider} />
              </header>

              {/* 대표 이미지 (image_url 미등록이면 placeholder) */}
              <div
                className={styles.image}
                style={news?.imageUrl ? { backgroundImage: `url(${news.imageUrl})` } : undefined}
              />

              {/* 본문 — DB 에는 Markdown 으로 저장됩니다. */}
              <div className={styles.body}>
                {parseNewsBody(news?.body).map((block, i) => {
                  if (block.type === 'list') {
                    return (
                      <ul key={i} className={styles.list}>
                        {block.items.map((li, j) => (
                          <li key={j} className={styles.listItem}>{li}</li>
                        ))}
                      </ul>
                    )
                  }
                  return (
                    <p key={i} className={block.muted ? styles.paraMuted : styles.para}>
                      {block.text}
                    </p>
                  )
                })}
              </div>

              <div className={styles.divider} />

              {/* 목록으로 */}
              <div className={styles.footerRow}>
                <Link to="/news" className={styles.listBtn}>목록으로</Link>
              </div>
            </article>
          </DataState>
        )}
      </div>

      <Footer />
    </>
  )
}
