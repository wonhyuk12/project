import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TourThumbnail from '../components/TourThumbnail';
import { getTourById, formatPrice } from '../data/tours';

const METHODS = [
  { id: 'card', label: '신용 · 체크카드' },
  { id: 'bank', label: '계좌이체' },
  { id: 'easy', label: '간편결제' },
];

function Checkout() {
  const location = useLocation();
  const bookingState = location.state;
  const tour = bookingState ? getTourById(bookingState.tourId) : null;
  const people = bookingState?.people ?? 2;
  const date = bookingState?.date || '[선택한 날짜]';
  const tier = tour?.tiers?.find((t) => t.id === bookingState?.tierId);
  const activePrice = tier ? tier.price : tour?.price;

  const [method, setMethod] = useState('card');
  const [agree, setAgree] = useState({ cancel: false, privacy: false, age: false });
  const [submitted, setSubmitted] = useState(false);

  const allAgreed = agree.cancel && agree.privacy && agree.age;

  function toggleAll() {
    const next = !allAgreed;
    setAgree({ cancel: next, privacy: next, age: next });
  }

  function toggleOne(key) {
    setAgree((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const total = activePrice != null ? activePrice * people : null;

  return (
    <>
      <Header />

      <div style={{ padding: '40px 60px 0', display: 'flex', flexDirection: 'column', gap: '26px', fontFamily: 'sans-serif' }}>
        <Link to={tour ? `/tour/${tour.id}` : '/'} style={{ fontSize: '14px', color: '#4A5568' }}>← 투어로 돌아가기</Link>
        <ol aria-label="진행 단계" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', gap: '12px', alignItems: 'center', fontSize: '14px' }}>
          <li style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#4A5568' }}>
            <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#DCE4EE', color: '#0C2340', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>✓</span>
            일정 선택
          </li>
          <li aria-hidden="true" style={{ width: '40px', height: '1px', background: '#C9D2DE' }} />
          <li style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#0C2340', fontWeight: 700 }}>
            <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#0C2340', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>2</span>
            정보 입력 · 결제
          </li>
          <li aria-hidden="true" style={{ width: '40px', height: '1px', background: '#C9D2DE' }} />
          <li style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#4A5568' }}>
            <span style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1px solid #C9D2DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>3</span>
            예약 확정
          </li>
        </ol>
        <h1 style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: '36px', color: '#0C2340' }}>예약 정보 확인 및 결제</h1>
      </div>

      <div style={{ padding: '36px 60px 90px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '64px', alignItems: 'start', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '44px' }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#0C2340' }}>예약자 정보</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>영문 성명 <span style={{ fontWeight: 400, color: '#4A5568' }}>· 여권과 동일하게</span></span>
                <input type="text" name="bookerName" placeholder="HONG GILDONG" style={{ height: '50px', border: '1px solid #C9D2DE', borderRadius: '4px', padding: '0 14px', fontSize: '15px', background: '#FFFFFF' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>휴대폰</span>
                <input type="tel" name="bookerPhone" placeholder="010-0000-0000" style={{ height: '50px', border: '1px solid #C9D2DE', borderRadius: '4px', padding: '0 14px', fontSize: '15px', background: '#FFFFFF' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 2' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>이메일 <span style={{ fontWeight: 400, color: '#4A5568' }}>· 예약 확정서가 발송됩니다</span></span>
                <input type="email" name="bookerEmail" placeholder="name@example.com" style={{ height: '50px', border: '1px solid #C9D2DE', borderRadius: '4px', padding: '0 14px', fontSize: '15px', background: '#FFFFFF' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 2' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>요청 사항 <span style={{ fontWeight: 400, color: '#4A5568' }}>(선택)</span></span>
                <textarea name="requests" rows="3" placeholder="룸메이트 지정, 왼손/오른손잡이용 렌탈클럽 필요 여부 등" style={{ border: '1px solid #C9D2DE', borderRadius: '4px', padding: '12px 14px', fontSize: '15px', background: '#FFFFFF', resize: 'none' }} />
              </label>
            </div>
            <span style={{ fontSize: '13px', color: '#4A5568' }}>항공권은 영문 성명으로 발권되며, 출발일 기준 여권 유효기간이 6개월 이상 남아있어야 합니다.</span>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#0C2340' }}>결제 수단</h2>
            <div role="radiogroup" aria-label="결제 수단" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={method === m.id}
                  onClick={() => setMethod(m.id)}
                  style={{
                    height: '64px',
                    borderRadius: '4px',
                    fontSize: '15px',
                    border: method === m.id ? '2px solid #0C2340' : '1px solid #C9D2DE',
                    background: method === m.id ? '#EEF2F7' : '#FFFFFF',
                    color: method === m.id ? '#0C2340' : '#1B2638',
                    fontWeight: method === m.id ? 700 : 400,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: '13px', color: '#4A5568' }}>[실제 제공 수단은 계약한 PG사에 따라 결정]</span>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '24px', background: '#FFFFFF', border: '1px solid #DDE2E9', borderRadius: '6px' }}>
            <label style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '16px', fontWeight: 700, color: '#0C2340', paddingBottom: '14px', borderBottom: '1px solid #E3E7ED' }}>
              <input type="checkbox" checked={allAgreed} onChange={toggleAll} style={{ width: '20px', height: '20px' }} />
              전체 동의
            </label>
            <label style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '14px' }}>
              <input type="checkbox" checked={agree.cancel} onChange={() => toggleOne('cancel')} style={{ width: '18px', height: '18px' }} />
              <span style={{ flexGrow: 1 }}>[필수] 취소·환불 규정 동의</span>
            </label>
            <label style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '14px' }}>
              <input type="checkbox" checked={agree.privacy} onChange={() => toggleOne('privacy')} style={{ width: '18px', height: '18px' }} />
              <span style={{ flexGrow: 1 }}>[필수] 개인정보 수집·이용 동의</span>
            </label>
            <label style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '14px' }}>
              <input type="checkbox" checked={agree.age} onChange={() => toggleOne('age')} style={{ width: '18px', height: '18px' }} />
              <span style={{ flexGrow: 1 }}>[필수] 만 14세 이상입니다</span>
            </label>
          </section>
        </div>

        <aside style={{ position: 'sticky', top: '24px', background: '#FFFFFF', border: '1px solid #DDE2E9', borderRadius: '6px', boxShadow: '0 14px 34px rgba(12,35,64,0.08)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {tour ? (
            <>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ width: '96px', flexShrink: 0 }}>
                  <TourThumbnail tour={tour} height="72px" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#1F5FA8' }}>{tour.region}</span>
                  <strong style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '17px', color: '#0C2340' }}>{tour.title}</strong>
                </div>
              </div>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '80px minmax(0, 1fr)', gap: '12px', fontSize: '15px', padding: '18px 0', borderTop: '1px solid #E3E7ED', borderBottom: '1px solid #E3E7ED' }}>
                <dt style={{ color: '#4A5568' }}>출발일</dt><dd style={{ margin: 0 }}>{date}</dd>
                <dt style={{ color: '#4A5568' }}>기간</dt><dd style={{ margin: 0 }}>{tour.duration}</dd>
                {tier && (
                  <>
                    <dt style={{ color: '#4A5568' }}>등급</dt><dd style={{ margin: 0 }}>{tier.label} · {tier.hotelGrade}</dd>
                  </>
                )}
                <dt style={{ color: '#4A5568' }}>인원</dt><dd style={{ margin: 0 }}>{people}명</dd>
              </dl>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#4A5568' }}>{formatPrice(activePrice)} × {people}명</span>
                  <span>{total == null ? '[가격 문의]' : `₩${total.toLocaleString()}`}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '14px', borderTop: '1px solid #E3E7ED' }}>
                  <strong style={{ fontSize: '16px', color: '#0C2340' }}>총 결제 금액</strong>
                  <strong style={{ fontSize: '24px', color: '#0C2340' }}>{total == null ? '[가격 문의]' : `₩${total.toLocaleString()}`}</strong>
                </div>
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: '14px', color: '#4A5568' }}>
              선택한 투어 정보가 없습니다. <Link to="/" style={{ color: '#1F5FA8' }}>투어 목록으로 돌아가기</Link>
            </p>
          )}

          <button
            type="button"
            disabled={!allAgreed || !tour}
            onClick={() => setSubmitted(true)}
            style={{
              height: '58px',
              border: 0,
              borderRadius: '4px',
              fontSize: '17px',
              fontWeight: 700,
              background: allAgreed && tour ? '#1F5FA8' : '#C9D2DE',
              color: allAgreed && tour ? '#FFFFFF' : '#4A5568',
            }}
          >
            {allAgreed ? '결제하기' : '필수 항목에 동의해 주세요'}
          </button>

          {submitted && (
            <p style={{ margin: 0, fontSize: '13px', color: '#1F5FA8', lineHeight: 1.6 }}>
              예약이 접수되었습니다. (실제 결제 연동은 백엔드 작업에서 이어집니다)
            </p>
          )}

          <span style={{ fontSize: '13px', color: '#4A5568' }}>
            결제는 [PG사]의 보안 결제창에서 진행되며, 카드 정보는 JINTOUR 서버에 저장되지 않습니다.
          </span>
        </aside>
      </div>

      <Footer />
    </>
  );
}

export default Checkout;
