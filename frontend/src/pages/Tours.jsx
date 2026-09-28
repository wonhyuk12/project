import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TourThumbnail from '../components/TourThumbnail';
import { tours, formatPrice, getDisplayPrice } from '../data/tours';

function Tours() {
  return (
    <>
      <Header />

      <section style={{
        padding: '80px 60px 90px',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        fontFamily: 'sans-serif'
      }}>
        <h1 style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: '36px', color: '#0C2340' }}>전체 투어</h1>

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

export default Tours;
