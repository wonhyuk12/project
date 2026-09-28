import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TourThumbnail from '../components/TourThumbnail';
import { tours, formatPrice, getDisplayPrice } from '../data/tours';

function Home() {
  return (
    <>
      <Header />

      <section style={{
        position: 'relative',
        background: '#16304F',
        color: '#fefdfd',
        padding: '100px 60px 150px',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        fontFamily: 'sans-serif'
      }}>
        <span style={{ fontSize: '13px', letterSpacing: '0.2em', color: '#A9C1DE', fontWeight: 500 }}>
          PRIVATE LOCAL GUIDE · THAILAND
        </span>
        <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '48px', lineHeight: 1.3, margin: 0, maxWidth: '700px' }}>
          베테랑 가이드와 함께하는, 기대에 맞춘 여행
        </h1>
        <p style={{ fontSize: '18px', color: '#b6bac0', maxWidth: '600px', lineHeight: 1.7 }}>
          직접 걷고 설계한 코스, 소규모 정원.
        </p>
        <div style={{ display: 'flex', gap: '14px' }}>
          <Link to="/tours" style={{ background: '#fff', color: '#0C2340', padding: '16px 28px', borderRadius: '4px', fontWeight: 700 }}>
            투어 둘러보기
          </Link>
        </div>
        <div style={{ display: 'flex', gap: '28px', paddingTop: '8px' }}>
          <span style={{ fontSize: '14px', color: '#D5E0EE' }}>✓ 쇼핑 강매 없음</span>
          <span style={{ fontSize: '14px', color: '#D5E0EE' }}>✓ 소규모 정원</span>
          <span style={{ fontSize: '14px', color: '#D5E0EE' }}>✓ 투명한 환불 규정</span>
        </div>

        <form style={{
          position: 'absolute',
          left: '60px',
          right: '60px',
          bottom: '-50px',
          background: '#fff',
          borderRadius: '6px',
          boxShadow: '0 18px 40px rgba(12,35,64,0.14)',
          padding: '20px 28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr) 200px',
          gap: '20px',
          alignItems: 'center',
          color: '#1B2638',
          boxSizing: 'border-box'
        }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700 }}>지역</span>
            <select name="region" style={{ border: 'none', fontSize: '16px' }}>
              <option>전체 지역</option>
              <option>방콕·파타야</option>
              <option>후아힌</option>
              <option>푸켓</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700 }}>날짜</span>
            <input type="text" name="date" placeholder="날짜 선택" style={{ border: 'none', fontSize: '16px' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700 }}>인원</span>
            <input type="text" name="people" placeholder="인원 선택" style={{ border: 'none', fontSize: '16px' }} />
          </label>
          <button type="button" style={{ height: '50px', border: 'none', background: '#1F5FA8', color: '#fff', fontWeight: 700, borderRadius: '4px' }}>
            예약 가능 투어 찾기
          </button>
        </form>
      </section>

      <section style={{
        padding: '150px 60px 90px',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: '32px', color: '#0C2340' }}>대표 투어</h2>
          <Link to="/tours" style={{ fontSize: '15px', fontWeight: 500 }}>전체 투어 보기 →</Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
          {tours.map((tour) => (
            <Link
              key={tour.id}
              to={`/tour/${tour.id}`}
              style={{ color: '#1B2638', display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <TourThumbnail tour={tour} />
              <span style={{ fontSize: '13px', color: '#1F5FA8', fontWeight: 700 }}>{tour.region}</span>
              <strong style={{ fontSize: '20px', color: '#0C2340' }}>{tour.title}</strong>
              <span style={{ fontSize: '14px', color: '#4A5568' }}>{tour.duration} · {tour.language}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0C2340' }}>{formatPrice(getDisplayPrice(tour))}</span>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}

export default Home;
