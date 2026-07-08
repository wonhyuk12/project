import { useParams, Link } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import PageHead from '../../components/PageHead'
import { getNewsById } from '../../data/news'
import styles from './NewsDetail.module.css'

export default function NewsDetail() {
  const { id } = useParams()
  const news = getNewsById(id)

  return (
    <>
      <Header variant="solid" />
      <PageHead
        label="NOTICE"
        title={<>까치커피바의 <span className="accent">소식</span></>}
        breadcrumb={['홈', '소식', '상세']}
      />

      <div className={styles.wrap}>
        {!news ? (
          <div className={styles.detail}>
            <p className={styles.notFound}>존재하지 않는 글입니다.</p>
            <div className={styles.footerRow}>
              <Link to="/news" className={styles.listBtn}>목록으로</Link>
            </div>
          </div>
        ) : (
          <article className={styles.detail}>
            {/* 글 머리 */}
            <header className={styles.head}>
              <span className={styles.catBadge}>{news.category}</span>
              <h2 className={styles.title}>{news.title}</h2>
              <div className={styles.meta}>
                <span>작성자 {news.author}</span>
                <span>작성일 {news.date}</span>
                <span>조회 {news.views}</span>
              </div>
              <div className={styles.divider} />
            </header>

            {/* 대표 이미지 placeholder */}
            <div className={styles.image} />

            {/* 본문 */}
            <div className={styles.body}>
              {news.body.map((block, i) => {
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
        )}
      </div>

      <Footer />
    </>
  )
}
