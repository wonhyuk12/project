import { Link } from 'react-router-dom'
import Container from '../../../components/Container'
import SectionHeading from '../../../components/SectionHeading'
import styles from './Signature.module.css'

const ITEMS = [
  {
    no: '01',
    name: 'Double Chocolate Brownie',
    desc: ['매장에서 직접 만드는 꾸덕한 식감의', '수제 더블초코 브라우니'],
    price: '4,500원',
  },
  {
    no: '02',
    name: 'GGachi Madeleine',
    desc: ['겉은 바삭, 속은 촉촉한', '까치커피바의 시그니처 마들렌'],
    price: '2,900원',
  },
  {
    no: '03',
    name: 'Hand Drip Coffee',
    desc: ['신선한 원두로 정성껏 내리는', '까치커피바의 핸드드립 커피'],
    price: '5,000원',
  },
]

export default function Signature() {
  return (
    <section id="signature" className={styles.section}>
      <Container className={styles.inner}>
        <SectionHeading
          label="SIGNATURE"
          title={<>까치커피바의 <span className="accent">시그니처 메뉴</span></>}
          description="정성스럽게 고르고, 매장에서 직접 만들어 까치커피만의 맛으로 준비합니다."
        />

        <div className={styles.cards}>
          {ITEMS.map((item) => (
            <article key={item.no} className={styles.card}>
              <div className={styles.image} />
              <div className={styles.body}>
                <p className={styles.no}>{item.no}</p>
                <h3 className={styles.name}>{item.name}</h3>
                <p className={styles.desc}>
                  {item.desc.map((line, i) => (
                    <span key={i}>{line}<br /></span>
                  ))}
                </p>
                <p className={styles.price}>{item.price}</p>
              </div>
            </article>
          ))}
        </div>

        <Link to="/menu" className={styles.more}>전체 메뉴 보기&nbsp;&nbsp;›</Link>
      </Container>
    </section>
  )
}
