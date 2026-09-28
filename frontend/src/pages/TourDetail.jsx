import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TourThumbnail from '../components/TourThumbnail';
import { getTourById, formatPrice } from '../data/tours';

function TourDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const tour = getTourById(id);

  const [date, setDate] = useState('');
  const [people, setPeople] = useState(2);
  const [tierId, setTierId] = useState(tour?.tiers?.find((t) => t.id === 'premium')?.id ?? tour?.tiers?.[0]?.id);

  if (!tour) {
    return (
      <>
        <Header />
        <div style={{ padding: '100px 60px', fontFamily: 'sans-serif' }}>
          <p style={{ fontSize: '18px', color: '#4A5568' }}>투어를 찾을 수 없습니다.</p>
          <Link to="/" style={{ color: '#1F5FA8' }}>홈으로 돌아가기</Link>
        </div>
        <Footer />
      </>
    );
  }

  const tier = tour.tiers?.find((t) => t.id === tierId);
  const activePrice = tier ? tier.price : tour.price;
  const total = activePrice == null ? null : activePrice * people;
  const isOddCount = people % 2 !== 0;

  function handleBooking() {
    navigate('/checkout', {
      state: { tourId: tour.id, date, people, tierId: tier?.id },
    });
  }

  return (
    <>
      <Header />

      <div style={{ padding: '28px 60px 0', fontFamily: 'sans-serif' }}>
        <nav aria-label="breadcrumb" style={{ fontSize: '13px', color: '#4A5568', display: 'flex', gap: '8px' }}>
          <Link to="/" style={{ color: '#4A5568' }}>홈</Link>
          <span>/</span>
          <span>{tour.region}</span>
          <span>/</span>
          <span style={{ color: '#1B2638' }}>{tour.title}</span>
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          <span style={{ fontSize: '13px', color: '#1F5FA8', fontWeight: 700 }}>{tour.region} · 골프 패키지</span>
          <h1 style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: '42px', color: '#0C2340' }}>{tour.title}</h1>
          <span style={{ fontSize: '15px', color: '#4A5568' }}>{tour.duration} · {tour.language} · {tour.departureBasis}</span>
        </div>
      </div>

      <div style={{ padding: '28px 60px 0' }}>
        <TourThumbnail tour={tour} height="320px" />
        {tour.photoCredit && (
          <span style={{ fontSize: '12px', color: '#8C9DB3' }}>사진: {tour.photoCredit}</span>
        )}
      </div>

      <div style={{ padding: '56px 60px 100px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '64px', alignItems: 'start', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid #DDE2E9', borderBottom: '1px solid #DDE2E9' }}>
            <div style={{ padding: '22px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#4A5568', fontWeight: 700 }}>여행 기간</span>
              <span style={{ fontSize: '16px', color: '#0C2340' }}>{tour.duration}</span>
            </div>
            <div style={{ padding: '22px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#4A5568', fontWeight: 700 }}>라운드</span>
              <span style={{ fontSize: '16px', color: '#0C2340' }}>{tour.rounds}</span>
            </div>
            <div style={{ padding: '22px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#4A5568', fontWeight: 700 }}>출발 기준</span>
              <span style={{ fontSize: '16px', color: '#0C2340' }}>{tour.departureBasis}</span>
            </div>
            <div style={{ padding: '22px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#4A5568', fontWeight: 700 }}>호텔 등급</span>
              <span style={{ fontSize: '16px', color: '#0C2340' }}>{tier?.hotelGrade}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: '26px', color: '#0C2340' }}>패키지 소개</h2>
            <p style={{ margin: 0, fontSize: '17px', lineHeight: 1.9, color: '#2F3B4E' }}>{tour.intro}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: '26px', color: '#0C2340' }}>골프 코스</h2>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {tour.courses.map((course) => (
                <li key={course} style={{ padding: '10px 18px', background: '#EEF2F7', borderRadius: '999px', fontSize: '14px', color: '#0C2340' }}>
                  {course}
                </li>
              ))}
            </ul>
            <span style={{ fontSize: '13px', color: '#4A5568' }}>실제 라운드는 위 코스 중 이번 일정({tour.rounds})에 배정되는 곳에서 진행됩니다. 자세한 배정은 일자별 일정을 참고해 주세요.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <h2 style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: '26px', color: '#0C2340' }}>일자별 일정</h2>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
              {tour.itinerary.map((day) => (
                <li key={day.day} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: '16px', paddingBottom: '22px' }}>
                  <span style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: '#0C2340', color: '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700
                  }}>
                    {day.day}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <strong style={{ fontSize: '17px', color: '#0C2340' }}>{day.title}</strong>
                    <span style={{ fontSize: '15px', color: '#4A5568', lineHeight: 1.7 }}>{day.body}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0C2340' }}>포함</h3>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '15px', lineHeight: 2, color: '#2F3B4E' }}>
                {tour.includes.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0C2340' }}>불포함</h3>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '15px', lineHeight: 2, color: '#2F3B4E' }}>
                {tour.excludes.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: '26px', color: '#0C2340' }}>취소 · 환불 규정</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '14px 16px', background: '#EEF2F7', color: '#0C2340' }}>취소 시점</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', background: '#EEF2F7', color: '#0C2340' }}>환불</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid #DDE2E9' }}>출발 8일 전까지</td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid #DDE2E9' }}>전액 환불</td>
                </tr>
                <tr>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid #DDE2E9' }}>출발 7일 이내</td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid #DDE2E9' }}>환불 불가 (항공권 · 골프장 예약 확정 비용 발생)</td>
                </tr>
                <tr>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid #DDE2E9' }}>최소 출발 인원 미달 · 항공/골프장 사정으로 여행사가 취소</td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid #DDE2E9' }}>전액 환불</td>
                </tr>
              </tbody>
            </table>
            <span style={{ fontSize: '13px', color: '#4A5568' }}>골프 라운드 당일 우천 취소 시 환불 기준은 각 골프장 규정을 따릅니다.</span>
          </div>
        </div>

        <aside style={{ position: 'sticky', top: '24px', background: '#FFFFFF', border: '1px solid #DDE2E9', borderRadius: '6px', boxShadow: '0 14px 34px rgba(12,35,64,0.08)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {tour.tiers && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1B2638' }}>등급 선택</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {tour.tiers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTierId(t.id)}
                    style={{
                      height: '46px',
                      borderRadius: '4px',
                      fontSize: '14px',
                      border: t.id === tierId ? '1px solid #0C2340' : '1px solid #C9D2DE',
                      background: t.id === tierId ? '#0C2340' : '#FFFFFF',
                      color: t.id === tierId ? '#FFFFFF' : '#1B2638',
                      fontWeight: t.id === tierId ? 700 : 400,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: '13px', color: '#4A5568' }}>{tier?.hotelGrade}</span>
              {tier?.perks && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', background: '#EEF2F7', borderRadius: '4px', padding: '12px 14px' }}>
                  {tier.perks.map((perk) => (
                    <li key={perk} style={{ fontSize: '13px', color: '#0C2340', lineHeight: 1.5 }}>✓ {perk}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 700, color: '#0C2340' }}>{formatPrice(activePrice)}</span>
            <span style={{ fontSize: '14px', color: '#4A5568' }}>/ 1인 (2인 1실 기준)</span>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1B2638' }}>출발일</span>
            <input
              type="text"
              name="tourDate"
              placeholder="예약 가능 날짜 선택"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ height: '48px', border: '1px solid #C9D2DE', borderRadius: '4px', padding: '0 14px', fontSize: '15px' }}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1B2638' }}>인원</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button type="button" onClick={() => setPeople((p) => Math.max(p - 1, 2))} aria-label="인원 줄이기" style={{ width: '44px', height: '44px', border: '1px solid #C9D2DE', background: '#FFFFFF', borderRadius: '50%', fontSize: '20px', color: '#0C2340' }}>−</button>
              <span style={{ minWidth: '40px', textAlign: 'center', fontSize: '17px', fontWeight: 700, color: '#0C2340' }}>{people}명</span>
              <button type="button" onClick={() => setPeople((p) => Math.min(p + 1, 10))} aria-label="인원 늘리기" style={{ width: '44px', height: '44px', border: '1px solid #C9D2DE', background: '#FFFFFF', borderRadius: '50%', fontSize: '20px', color: '#0C2340' }}>+</button>
            </div>
          </div>

          <span style={{ fontSize: '13px', color: '#4A5568', lineHeight: 1.6 }}>
            {tour.departureBasis} · {tour.singleRoomNote}
            {isOddCount && ' · 홀수 인원은 1인 단독 객실이 발생해 추가 요금이 붙을 수 있습니다'}
          </span>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '18px', borderTop: '1px solid #E3E7ED', fontSize: '15px' }}>
            <span style={{ color: '#4A5568' }}>{formatPrice(activePrice)} × {people}명</span>
            <strong style={{ color: '#0C2340' }}>{total == null ? '[가격 문의]' : `₩${total.toLocaleString()}`}</strong>
          </div>

          <button
            type="button"
            onClick={handleBooking}
            style={{ height: '56px', border: 0, background: '#1F5FA8', color: '#fff', borderRadius: '4px', fontSize: '17px', fontWeight: 700 }}
          >
            예약하고 결제하기
          </button>
          <span style={{ fontSize: '13px', lineHeight: 1.7, color: '#4A5568', textAlign: 'center' }}>
            출발 8일 전까지 전액 환불
          </span>
        </aside>
      </div>

      <Footer />
    </>
  );
}

export default TourDetail;
