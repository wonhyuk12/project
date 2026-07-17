import { Link } from 'react-router-dom'
import Container from '../../../components/Container'
import SectionHeading from '../../../components/SectionHeading'
import DataState from '../../../components/DataState'
import useApiData from '../../../hooks/useApiData'
import { formatWon } from '../../../utils/format'
import styles from './Subscription.module.css'

export default function Subscription() {
  const { data: plans, loading, error } = useApiData('/api/plans', [])

  return (
    <section id="subscription" className={styles.section}>
      <Container className={styles.inner}>
        <SectionHeading
          label="SUBSCRIPTION"
          title={<>매일 한 잔의 여유, 까치커피바 <span className="accent">정기구독</span></>}
          description="매일 커피 한 잔이 필요하신 분! 아메리카노 410ML를 더 합리적인 가격으로 즐겨보세요."
        />

        <DataState loading={loading} error={error} empty={plans.length === 0}>
          <div className={styles.plans}>
            {plans.map((plan) => (
              <div key={plan.code} className={styles.plan}>
                {plan.badge && <span className={styles.badge}>{plan.badge}</span>}
                <p className={styles.planName}>{plan.name}</p>
                <p className={styles.was}>{formatWon(plan.originalPrice)}</p>
                <p className={styles.now}>{formatWon(plan.price)}</p>
                <div className={styles.divider} />
                <p className={styles.planDesc}>{plan.description}</p>
                <p className={styles.planDesc}>결제일부터 {plan.durationDays}일</p>
                <Link to={`/subscribe?plan=${plan.code}`} className={styles.planBtn}>
                  {plan.name} 구독하기&nbsp;&nbsp;›
                </Link>
              </div>
            ))}
          </div>
        </DataState>

        <p className={styles.note}>
          정기구독은 매장 방문 시 신용/체크카드로 결제 후 이용 가능합니다.&nbsp;&nbsp;|&nbsp;&nbsp;타 음료 변경 및 양도는 불가합니다.
        </p>
      </Container>
    </section>
  )
}
