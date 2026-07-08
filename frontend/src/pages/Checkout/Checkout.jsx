import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import PageHead from '../../components/PageHead'
import { PLANS, getPlanById } from '../../data/plans'
import styles from './Checkout.module.css'

// 결제 수단 (로고 색상은 각 브랜드 고유색이라 인라인 처리)
const PAY_METHODS = [
  { id: 'kakao', label: '카카오페이', logo: 'pay', logoBg: '#fee500', logoColor: '#3b1e1e' },
  { id: 'toss', label: '토스페이', logo: 'toss', logoBg: '#0064ff', logoColor: '#ffffff' },
  { id: 'card', label: '신용카드', logo: 'CARD', logoBg: '#f9f3ea', logoColor: '#a0482c' },
]

export default function Checkout() {
  const [searchParams] = useSearchParams()
  // 홈에서 넘어온 ?plan=10/20/30 을 초기 선택값으로 사용 (없으면 10일권)
  const initialPlan = getPlanById(searchParams.get('plan')) ? searchParams.get('plan') : '10'

  const [planId, setPlanId] = useState(initialPlan)
  const [pay, setPay] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const selectedPlan = getPlanById(planId)

  const handleSubmit = (e) => {
    e.preventDefault()
    // 데모 화면 — 실제 결제/전송 없이 선택 정보만 확인합니다.
    const payLabel = PAY_METHODS.find((m) => m.id === pay)?.label ?? '(선택 안 함)'
    alert(
      '데모 신청 정보 확인\n\n' +
      `구독 상품: ${selectedPlan.name} (${selectedPlan.price})\n` +
      `이름: ${name || '(미입력)'}\n` +
      `연락처: ${phone || '(미입력)'}\n` +
      `결제 수단: ${payLabel}`
    )
  }

  return (
    <>
      <Header variant="solid" />
      <PageHead
        label="SUBSCRIPTION"
        title={<>정기구독 <span className="accent">신청</span></>}
        description="아메리카노 410ML 매일 1잔, 합리적인 정기구독을 신청하세요."
        breadcrumb={['홈', '정기구독', '신청']}
      />

      <div className={styles.wrap}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.notice}>
            실제 결제는 진행되지 않는 데모 화면입니다. (선택 정보 확인용)
          </div>

          <div className={styles.card}>
            {/* 구독 상품 */}
            <fieldset className={styles.section}>
              <legend className={styles.label}>구독 상품 <span className={styles.req}>*</span></legend>
              <div className={styles.options}>
                {PLANS.map((plan) => (
                  <button
                    type="button"
                    key={plan.id}
                    className={`${styles.planOption} ${planId === plan.id ? styles.planSelected : ''}`}
                    onClick={() => setPlanId(plan.id)}
                  >
                    <span className={styles.planName}>{plan.name}</span>
                    <span className={styles.planPrice}>{plan.price}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* 신청자 정보 */}
            <fieldset className={styles.section}>
              <legend className={styles.label}>신청자 정보 <span className={styles.req}>*</span></legend>
              <input
                className={styles.input}
                type="text"
                placeholder="이름을 입력하세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className={styles.input}
                type="tel"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </fieldset>

            {/* 결제 수단 */}
            <fieldset className={styles.section}>
              <legend className={styles.label}>결제 수단 <span className={styles.req}>*</span></legend>
              <div className={styles.options}>
                {PAY_METHODS.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className={`${styles.payOption} ${pay === m.id ? styles.paySelected : ''}`}
                    onClick={() => setPay(m.id)}
                  >
                    <span className={styles.payLogo} style={{ background: m.logoBg, color: m.logoColor }}>
                      {m.logo}
                    </span>
                    <span className={styles.payLabel}>{m.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* 합계 */}
            <div className={styles.totalSection}>
              <div className={styles.divider} />
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>{selectedPlan.name} 정기구독</span>
                <span className={styles.totalPrice}>{selectedPlan.price}</span>
              </div>
            </div>

            <button type="submit" className={styles.submit}>결제하기</button>
          </div>
        </form>
      </div>

      <Footer />
    </>
  )
}
