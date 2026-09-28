import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

const STEPS = [
  { title: '패키지 선택', body: '지역(방콕·파타야 / 후아힌)과 예산에 맞는 골프 패키지를 골라주세요.' },
  { title: '등급 · 출발일 · 인원 선택', body: '투어 상세 페이지에서 호텔 등급(프리미엄/실속), 출발일, 인원을 선택합니다. 2인 출발 기준 상품입니다.' },
  { title: '결제', body: '예약자 정보를 입력하고 결제하면 그 즉시 예약이 확정됩니다 — 별도 승인 대기 없음.' },
  { title: '확정 안내 수신', body: '항공편, 호텔, 골프 일정이 담긴 확정 메일을 받습니다.' },
];

function HowItWorks() {
  return (
    <>
      <Header />

      <section style={{
        padding: '80px 60px',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        fontFamily: 'sans-serif'
      }}>
        <h1 style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: '36px', color: '#0C2340' }}>예약 안내</h1>

        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
          {STEPS.map((step, i) => (
            <li key={step.title} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: '16px', paddingBottom: '26px' }}>
              <span style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: '#0C2340', color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: 700
              }}>
                {i + 1}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <strong style={{ fontSize: '18px', color: '#0C2340' }}>{step.title}</strong>
                <span style={{ fontSize: '15px', color: '#4A5568', lineHeight: 1.7 }}>{step.body}</span>
              </div>
            </li>
          ))}
        </ol>

        <p style={{ margin: 0, fontSize: '15px', color: '#4A5568' }}>
          취소 · 환불 규정이 궁금하시면 <Link to="/faq" style={{ color: '#1F5FA8' }}>자주 묻는 질문</Link>을 확인해주세요.
        </p>
      </section>

      <Footer />
    </>
  );
}

export default HowItWorks;
