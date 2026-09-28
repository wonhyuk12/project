import logoIcon from '../assets/logo-icon.png';

function Footer() {
  return (
    <footer style={{
      marginTop: 'auto',
      background: '#0A1B31',
      padding: '48px 60px',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src={logoIcon} alt="" style={{ height: '32px', width: '32px' }} />
        <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.1em', color: '#FFFFFF' }}>JINTOUR</span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px 40px',
        fontSize: '13px',
        lineHeight: 1.7,
        color: '#B7C6D9',
      }}>
        <span>상호 [상호명] · 대표 [이름]</span>
        <span>사업자등록번호 [000-00-00000]</span>
        <span>통신판매업 신고 [번호]</span>
        <span>여행업 등록번호 [해당 시]</span>
        <span>고객센터 [전화] · [이메일]</span>
        <span>© JINTOUR</span>
      </div>
    </footer>
  );
}

export default Footer;
