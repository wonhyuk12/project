import { Link } from 'react-router-dom';
import logoIcon from '../assets/logo-icon.png';

function Header() {
  return (
    <header style={{
      height: '84px',
      display: 'flex',
      alignItems: 'center',
      gap: '48px',
      padding: '0 60px',
      background: 'linear-gradient(120deg, #fbfdff 0%, #f0f5fc 45%, #e8f0fa 100%)',
      borderBottom: '1px solid #cacfd3',
      fontFamily: 'sans-serif'
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0C2340' }}>
        <img src={logoIcon} alt="" style={{ height: '44px', width: '44px' }} />
        <span style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.1em' }}>
          JINTOUR
        </span>
      </Link>
      <nav style={{ display: 'flex', gap: '36px', fontSize: '15px' }}>
        <Link to="/tours">투어</Link>
        <Link to="/how">예약 안내</Link>
        <Link to="/faq">자주 묻는 질문</Link>
      </nav>
    </header>
  );
}

export default Header;
