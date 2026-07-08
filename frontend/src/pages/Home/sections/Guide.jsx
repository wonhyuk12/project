import Container from '../../../components/Container'
import SectionHeading from '../../../components/SectionHeading'
import styles from './Guide.module.css'

// 디자인상 좌열 01·02·03 / 우열 04·05·06 순서로 배치됩니다.
const ROWS = [
  [
    { no: '01', title: '운영 시간', desc: ['월–토 08:00 – 20:00 · 일요일 12:00 – 20:00'] },
    { no: '04', title: '매장 이용', desc: ['1인 1음료 주문을 부탁드립니다.', '혼잡 시 이용 시간은 2시간으로 제한될 수 있습니다.'] },
  ],
  [
    { no: '02', title: '포장 안내', desc: ['모든 메뉴 포장 가능합니다.', '포장 시 500원 할인 혜택이 제공됩니다.'] },
    { no: '05', title: '와이파이', desc: ['ID kkachicoffee · PW kkachibar123'] },
  ],
  [
    { no: '03', title: '결제 안내', desc: ['모든 메뉴는 선결제입니다.', '현금, 카드, 간편결제 모두 가능합니다.'] },
    { no: '06', title: '반려동물 안내', desc: ['반려동물 동반은 야외 좌석만 가능합니다.', '목줄 착용을 부탁드립니다.'] },
  ],
]

function GuideItem({ item }) {
  return (
    <div className={styles.item}>
      <div className={styles.icon} aria-hidden="true" />
      <div className={styles.itemText}>
        <p className={styles.no}>{item.no}</p>
        <p className={styles.itemTitle}>{item.title}</p>
        <p className={styles.itemDesc}>
          {item.desc.map((line, i) => (
            <span key={i}>{line}{i < item.desc.length - 1 && <br />}</span>
          ))}
        </p>
      </div>
    </div>
  )
}

export default function Guide() {
  return (
    <section id="guide" className={styles.section}>
      <Container className={styles.inner}>
        <SectionHeading
          label="GUIDE"
          title={<>까치커피바 <span className="accent">이용안내</span></>}
          description="더 편안하고 즐거운 시간을 위해 이용 안내를 확인해주세요."
        />

        <div className={styles.items}>
          <div className={styles.divider} />
          {ROWS.map((row, i) => (
            <div key={i}>
              <div className={styles.row}>
                <GuideItem item={row[0]} />
                <GuideItem item={row[1]} />
              </div>
              <div className={styles.divider} />
            </div>
          ))}
        </div>

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
