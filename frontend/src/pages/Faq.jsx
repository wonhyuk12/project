import Header from '../components/Header';
import Footer from '../components/Footer';

function Faq() {
  return (
    <>
      <Header />

      <section style={{
        padding: '80px 60px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        fontFamily: 'sans-serif'
      }}>
        <h1 style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: '36px', color: '#0C2340' }}>자주 묻는 질문</h1>

        <details style={{ padding: '24px 0', borderTop: '1px solid #D5DBE3' }}>
          <summary style={{ fontSize: '17px', fontWeight: 500, color: '#0C2340', cursor: 'pointer' }}>
            혼자 신청해도 되나요?
          </summary>
          <p style={{ marginTop: '14px', fontSize: '15px', lineHeight: 1.8, color: '#4A5568' }}>
            네, 가능합니다. 다만 요금은 2인 1실 기준이라 1인 단독으로 객실을 쓰시면 싱글룸 추가 요금이 발생합니다. 또한 최소 2인 출발 기준 상품이라, 동반자가 없는 경우 다른 참가자와의 조인 여부를 사전에 안내드립니다.
          </p>
        </details>

        <details style={{ padding: '24px 0', borderTop: '1px solid #D5DBE3' }}>
          <summary style={{ fontSize: '17px', fontWeight: 500, color: '#0C2340', cursor: 'pointer' }}>
            골프채는 직접 챙겨가야 하나요?
          </summary>
          <p style={{ marginTop: '14px', fontSize: '15px', lineHeight: 1.8, color: '#4A5568' }}>
            태국 골프장 대부분은 렌탈 클럽을 갖추고 있어 급하면 현지에서 빌리실 수 있지만, 세트 상태나 대여료는 골프장마다 달라 본인 클럽을 가져오시는 걸 권장합니다. 항공사 위탁 수하물에 골프백이 무료로 포함되는지는 이용 항공사 규정에 따라 다르니 예약 전 확인해 주세요.
          </p>
        </details>

        <details style={{ padding: '24px 0', borderTop: '1px solid #D5DBE3' }}>
          <summary style={{ fontSize: '17px', fontWeight: 500, color: '#0C2340', cursor: 'pointer' }}>
            캐디피·카트비도 포함인가요?
          </summary>
          <p style={{ marginTop: '14px', fontSize: '15px', lineHeight: 1.8, color: '#4A5568' }}>
            그린피와 카트비는 패키지 요금에 포함되어 있습니다. 태국 골프장은 캐디 동반이 의무라 캐디피(보통 250~500밧)는 별도이며, 라운드 후 캐디에게 직접 드리는 캐디팁(관례상 200~500밧)도 현지 관행상 추가로 준비하시는 걸 권장합니다.
          </p>
        </details>

        <details style={{ padding: '24px 0', borderTop: '1px solid #D5DBE3' }}>
          <summary style={{ fontSize: '17px', fontWeight: 500, color: '#0C2340', cursor: 'pointer' }}>
            여권이나 준비물 관련 유의사항이 있나요?
          </summary>
          <p style={{ marginTop: '14px', fontSize: '15px', lineHeight: 1.8, color: '#4A5568' }}>
            항공권은 여권상 영문 성명으로 발권되며, 출발일 기준 여권 유효기간이 6개월 이상 남아있어야 합니다. 한국 여권 소지자는 한·태 비자면제협정에 따라 최대 90일까지 무비자 체류가 가능합니다(2026년 9월 기준 — 다른 국가는 30일로 축소됐지만 한국은 협정상 90일 그대로 유지). 다만 협정과 별개로 최신 입국 규정은 출발 전 외교부 해외안전여행 사이트에서 한 번 더 확인해 주세요.
          </p>
        </details>

        <details style={{ padding: '24px 0', borderTop: '1px solid #D5DBE3' }}>
          <summary style={{ fontSize: '17px', fontWeight: 500, color: '#0C2340', cursor: 'pointer' }}>
            현지에서 비가 와서 라운드를 못 하면 어떻게 되나요?
          </summary>
          <p style={{ marginTop: '14px', fontSize: '15px', lineHeight: 1.8, color: '#4A5568' }}>
            우천으로 인한 라운드 중단·취소 시 환불 기준은 각 골프장 자체 규정을 따릅니다. 정확한 기준은 [골프장별 확인 필요]이며, 확정 안내 메일에 함께 안내드립니다.
          </p>
        </details>

        <details style={{ padding: '24px 0', borderTop: '1px solid #D5DBE3', borderBottom: '1px solid #D5DBE3' }}>
          <summary style={{ fontSize: '17px', fontWeight: 500, color: '#0C2340', cursor: 'pointer' }}>
            예약을 취소하면 언제, 얼마나 환불되나요?
          </summary>
          <p style={{ marginTop: '14px', fontSize: '15px', lineHeight: 1.8, color: '#4A5568' }}>
            출발 8일 전까지는 전액 환불됩니다. 출발 7일 이내에는 항공권·골프장 예약이 이미 확정된 상태라 환불이 어렵습니다. 여행사 또는 항공/골프장 사정으로 인한 취소는 전액 환불해 드립니다. 자세한 내용은 각 투어 상세 페이지의 "취소·환불 규정"을 확인해 주세요.
          </p>
        </details>
      </section>

      <Footer />
    </>
  );
}

export default Faq;
