import { Link } from 'react-router-dom'
import Container from '../../../components/Container'
import SectionHeading from '../../../components/SectionHeading'
import styles from './Notice.module.css'

const NEWS = [
  {
    id: 1,
    date: '2024.06.08',
    isNew: true,
    title: '쫀득한 까치 브라우니 출시',
    desc: ['매장에서 직접 만드는 수제 더블초코', '브라우니가 새롭게 출시되었습니다.'],
  },
  {
    id: 2,
    date: '2024.06.05',
    isNew: true,
    title: '까치커피바 키링 굿즈 출시',
    desc: ['까치커피바의 감성을 담은 키링이', '새로 출시되었습니다.'],
  },
  {
    id: 3,
    date: '2024.05.28',
    isNew: false,
    title: '6월 매장 운영 안내',
    desc: ['6월 운영 시간 및 휴무일정을 안내드립니다.', '방문 전 확인 부탁드립니다.'],
  },
]

export default function Notice() {
  return (
    <section id="notice" className={styles.section}>
      <Container className={styles.inner}>
        <SectionHeading
          label="NOTICE"
          title={<>까치커피바의 <span className="accent">소식</span></>}
          description="까치커피바의 새로운 소식과 이벤트 정보를 확인해보세요."
        />

        <div className={styles.cards}>
          {NEWS.map((item) => (
            <Link key={item.id} to={`/news/${item.id}`} className={styles.card}>
              <div className={styles.image} />
              <div className={styles.body}>
                <div className={styles.metaRow}>
                  <span className={styles.date}>{item.date}</span>
                  {item.isNew && <span className={styles.new}>NEW</span>}
                </div>
                <h3 className={styles.title}>{item.title}</h3>
                <p className={styles.desc}>
                  {item.desc.map((line, i) => (
                    <span key={i}>{line}<br /></span>
                  ))}
                </p>
                <span className={styles.arrow}>→</span>
              </div>
            </Link>
          ))}
        </div>

        <Link to="/news" className={styles.more}>전체 소식 보기&nbsp;&nbsp;›</Link>
      </Container>
    </section>
  )
}
