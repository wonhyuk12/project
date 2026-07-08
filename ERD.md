# 까치커피바 — ERD (한글 설명판)

DB 구조를 "이게 왜 필요한지" 위주로 쉽게 정리한 문서입니다.
크게 **① 화면에 보여줄 데이터**와 **② 사용자 행동 분석용 데이터** 두 덩어리로 나뉩니다.

---

## 테이블 한눈에 보기

### ① 콘텐츠 (화면에 뿌리는 데이터)
| 테이블 | 한글 이름 | 무엇을 위한 것인가 |
|---|---|---|
| `store_info` | 매장 정보 | 주소·전화·영업시간·인스타. 헤더/푸터/이용안내에서 공통으로 씀 |
| `menu_categories` | 메뉴 카테고리 | 커피·라떼·스무디·디저트 같은 분류 |
| `menu_items` | 메뉴 항목 | 실제 메뉴(이름·가격·설명). **제품의 원천 데이터** |
| `home_signatures` | 홈 대표메뉴 | 홈 화면에 크게 띄우는 대표 메뉴 3종 (영문명·이미지) |
| `subscription_plans` | 구독 플랜 | 10/20/30일권 정기구독 상품 |
| `subscriptions` | 구독 신청내역 | 손님이 신청한 정기구독 기록 (누가·무엇을·얼마에) |
| `news` | 소식(공지) | 게시판 글. 목록/상세/홈 미리보기에서 공유 |
| `guide_items` | 이용안내 | 운영시간·포장·결제 같은 안내 6개 항목 |

### ② 분석 (사용자 행동 로그)
| 테이블 | 한글 이름 | 무엇을 위한 것인가 |
|---|---|---|
| `analytics_sessions` | 방문 세션 | 한 번의 방문 단위 (누가·어디서 들어왔나) |
| `analytics_events` | 행동 로그 | "어떤 페이지를 봤다"를 시간순으로 기록 → **흐름/퍼널 분석의 재료** |

---

## ERD (관계도)

```mermaid
erDiagram
    menu_categories ||--o{ menu_items : "분류에 메뉴 여러 개"
    menu_items ||--o| home_signatures : "대표메뉴로 노출"
    subscription_plans ||--o{ subscriptions : "플랜을 신청"
    analytics_sessions ||--o{ analytics_events : "방문 안에서 행동 여러 개"
    subscriptions }o--o| analytics_sessions : "어느 방문에서 신청했나"
    news ||--o{ analytics_events : "이 소식을 봄"
    subscription_plans ||--o{ analytics_events : "이 플랜을 봄"
    menu_items ||--o{ analytics_events : "이 메뉴를 봄"

    store_info {
        bigint id PK "고유번호"
        text brand_name_ko "상호(한글)"
        text phone "전화번호"
        text address "주소"
        text opening_hours "영업시간"
        text instagram "인스타 계정"
    }
    menu_categories {
        bigint id PK "고유번호"
        text name_en "영문명(COFFEE)"
        text name_ko "한글명(커피)"
        int sort_order "정렬순서"
    }
    menu_items {
        bigint id PK "고유번호"
        bigint category_id FK "소속 카테고리"
        text name "메뉴 이름"
        text note "짧은 설명(디카페인 변경 가능)"
        int price "가격(원)"
        bool is_representative "대표 배지 여부"
        int sort_order "정렬순서"
    }
    home_signatures {
        bigint id PK "고유번호"
        bigint menu_item_id FK "연결된 메뉴"
        text name_en "영문 표시명"
        text tagline "카드 설명문구"
        text image_url "이미지 주소"
        int sort_order "정렬순서"
    }
    subscription_plans {
        bigint id PK "고유번호"
        text code "코드(10/20/30)"
        text name "플랜명(10일권)"
        int original_price "정가"
        int price "할인가"
        int duration_days "이용일수"
        text badge "배지(BEST 등)"
        bool is_active "판매중 여부"
    }
    subscriptions {
        bigint id PK "고유번호"
        bigint plan_id FK "신청한 플랜"
        text customer_name "신청자 이름"
        text customer_phone "연락처"
        text pay_method "결제수단(kakao/toss/card)"
        int amount "결제금액(신청시점 저장)"
        text status "상태(신청/결제/취소)"
        date start_date "시작일"
        date end_date "종료일"
        uuid session_id FK "어느 방문에서 신청"
        timestamptz created_at "신청일시"
    }
    news {
        bigint id PK "고유번호"
        text category "구분(공지)"
        text title "제목"
        bool is_new "NEW 배지"
        text author "작성자"
        text body "본문(Markdown)"
        text image_url "대표 이미지"
        int views "조회수"
        timestamptz published_at "작성일"
    }
    guide_items {
        bigint id PK "고유번호"
        text no "번호(01~06)"
        text title "제목(운영 시간)"
        text body "안내 내용"
        int sort_order "정렬순서"
    }
    analytics_sessions {
        uuid id PK "세션 고유키"
        text anonymous_id "방문자 식별자(비회원)"
        text referrer "유입 출처"
        text landing_path "첫 진입 페이지"
        text device "기기(모바일/PC)"
        timestamptz started_at "방문 시작시각"
    }
    analytics_events {
        bigint id PK "고유번호"
        uuid session_id FK "소속 방문 세션"
        text event_type "행동종류(page_view 등)"
        text page_name "페이지(home/menu/…)"
        text path "실제 경로(/news/1)"
        text referrer_path "직전 페이지"
        bigint news_id FK "본 소식(있으면)"
        bigint plan_id FK "본 플랜(있으면)"
        bigint menu_item_id FK "본 메뉴(있으면)"
        timestamptz occurred_at "발생시각"
    }
```

---

## 관계(선) 읽는 법

- **메뉴 카테고리 1 : N 메뉴 항목** — 카테고리(커피) 하나에 메뉴(아메리카노, 라떼…)가 여러 개.
- **메뉴 항목 1 : (0~1) 홈 대표메뉴** — 어떤 메뉴는 홈 대표로 뽑혀 노출됨(안 뽑히면 없음).
- **구독 플랜 1 : N 구독 신청** — 플랜(10일권) 하나를 여러 손님이 신청.
- **방문 세션 1 : N 행동 로그** — 한 번 방문 동안 여러 페이지를 봄(이게 흐름 분석의 핵심).
- **구독 신청 ↔ 방문 세션** — "어느 방문에서 신청까지 이어졌나"를 연결해 **전환율** 계산.
- **소식/플랜/메뉴 1 : N 행동 로그** — "어떤 소식·플랜·메뉴를 봤는지"를 행동 로그에 FK로 연결(안 본 이벤트는 null). → 인기 콘텐츠 집계 가능.

---

## ②번(행동 로그)이 왜 있는가 — 한 줄 그림

```
손님이 페이지를 볼 때마다
   →  analytics_events 에 "언제 / 어떤 페이지" 한 줄씩 쌓임
       →  같은 방문(session) 안에서 시간순으로 이으면
            →  "홈 → 메뉴 → 정기구독 → 신청" 같은 이동 흐름이 보임
                →  어디서 많이 이탈하는지, 신청까지 몇 %가 가는지 분석 가능
```

> 정리: **①번 테이블**은 "화면에 뭘 보여줄까", **②번 테이블**은 "손님이 실제로 어떻게 돌아다녔나"를 담습니다.
> 상세 SQL/쿼리는 `SCHEMA.md` 참고.
