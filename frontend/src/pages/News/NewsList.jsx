import { Link } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import Container from '../../components/Container'
import PageHead from '../../components/PageHead'
import { NEWS } from '../../data/news'
import styles from './NewsList.module.css'

export default function NewsList() {
  return (
    <>
      <Header variant="solid" />
      <PageHead
        label="NOTICE"
        title={<>까치커피바의 <span className="accent">소식</span></>}
        description="까치커피바의 새로운 소식과 이벤트 정보를 확인해보세요."
        breadcrumb={['홈', '소식']}
      />

      <Container className={styles.board}>
        <p className={styles.count}>전체 {NEWS.length}건</p>

        <div className={styles.table}>
          <div className={styles.topRule} />

          {/* 헤더 행 */}
          <div className={`${styles.row} ${styles.headRow}`}>
            <span className={styles.colCat}>구분</span>
            <span className={styles.colTitle}>제목</span>
            <span className={styles.colAuthor}>작성자</span>
            <span className={styles.colDate}>작성일</span>
            <span className={styles.colViews}>조회</span>
          </div>
          <div className={styles.divider} />

          {/* 데이터 행 */}
          {NEWS.map((item) => (
            <div key={item.id}>
              <div className={styles.row}>
                <span className={styles.colCat}>
                  <span className={styles.catBadge}>{item.category}</span>
                </span>
                <Link to={`/news/${item.id}`} className={`${styles.colTitle} ${styles.titleCell}`}>
                  <span className={styles.titleText}>{item.title}</span>
                  {item.isNew && <span className={styles.newBadge}>NEW</span>}
                </Link>
                <span className={styles.colAuthor}>{item.author}</span>
                <span className={styles.colDate}>{item.date}</span>
                <span className={styles.colViews}>{item.views}</span>
              </div>
              <div className={styles.divider} />
            </div>
          ))}
        </div>

        {/* 페이지네이션 */}
        <div className={styles.pagination}>
          <span className={styles.pageActive}>1</span>
        </div>
      </Container>

      <Footer />
    </>
  )
}
