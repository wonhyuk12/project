# 까치커피바 DB 설명서

> 팀 공유용. ERD는 `docs/ERD.mermaid` 참고.
> DB는 Supabase(PostgreSQL)이며, 크게 두 영역으로 나뉜다.

| 영역 | 역할 | 비유 |
|---|---|---|
| **콘텐츠 스키마** (7개 테이블) | 화면에 표시되는 데이터 | 매장의 상품 창고 |
| **분석 스키마** (2개 테이블) | 방문자 행동 기록 | 매장의 CCTV 기록장부 |

---

## 1. 콘텐츠 스키마 — 화면에 뿌리는 데이터

### store_info — 매장 기본 정보
헤더·푸터·정보바에 공통으로 뜨는 매장 정보. 사실상 **1행짜리** 테이블.

| 컬럼 | 한글 뜻 | 예시 |
|---|---|---|
| brand_name_ko / en | 상호(한/영) | 까치커피바 / GGACHI COFFEE BAR |
| phone | 전화번호 | 0507-1445-6303 |
| address | 주소 | 대전 유성구 대학로81번길 59 101호 |
| opening_hours | 영업시간 | 월–토 08:00–20:00 |
| instagram | 인스타그램 계정 | @GGachi_coffeebar |

### menu_categories — 메뉴 카테고리
메뉴판의 큰 묶음. COFFEE / LATTE / SMOOTHIE / DESSERT 4개.

| 컬럼 | 한글 뜻 |
|---|---|
| name_en / name_ko | 카테고리명 영문/한글 (COFFEE / 커피) |
| sort_order | 정렬 순서 (화면에 보이는 순서) |

### menu_items — 메뉴 항목 ★원천 데이터
메뉴판의 각 상품. **모든 메뉴 정보의 원본**이다.

| 컬럼 | 한글 뜻 | 예시 |
|---|---|---|
| category_id | 소속 카테고리 (FK) | → LATTE |
| name | 메뉴명 | 까치라떼 |
| note | 짧은 부가 설명 | 디카페인 변경 가능 |
| price | 가격 (원 단위 정수) | 5500 → 화면에서 "5,500원"으로 포맷 |
| is_representative | '대표' 배지 여부 | 메뉴판의 대표 표시 |
| is_sold_out | 품절 여부 | |

### home_signatures — 홈 시그니처 큐레이션
홈 화면 "시그니처 메뉴" 카드 3개. **메뉴판의 '대표'와 별개 개념**이라 분리했다.
menu_items를 가리키면서(FK) 홈 전용 표현(영문명·설명·이미지)만 추가로 갖는다.

| 컬럼 | 한글 뜻 | 예시 |
|---|---|---|
| menu_item_id | 원본 메뉴 (FK) | → 까치 브라우니 |
| name_en | 카드 영문명 | Double Chocolate Brownie |
| tagline | 카드 설명 문구 | 매장에서 직접 만드는 꾸덕한 식감의… |
| image_url | 카드 이미지 | |

**분리한 이유**: "홈에 뭘 내세울까"는 마케팅 결정이고, 메뉴판은 상품 원본이다. 섞어두면 홈 큐레이션을 바꿀 때마다 상품 데이터를 건드리게 된다.

### subscription_plans — 정기구독 플랜
10일권 / 20일권 / 30일권 상품 정의.

| 컬럼 | 한글 뜻 | 예시 |
|---|---|---|
| code | 플랜 코드 | '10', '20', '30' |
| original_price / price | 정가 / 할인가 | 12,000 / 10,000 |
| duration_days | 이용 일수 | 10 |
| description | 상품 설명 | 아메리카노 410ML 매일 1잔 |
| badge | 카드 배지 | 'BEST', '하루 990원' |
| is_active | 판매 중 여부 | false면 화면에서 숨김 |

### subscriptions — 정기구독 신청 ★고객이 쓰는 유일한 테이블
Checkout 폼 제출 기록. 나머지는 전부 "보여주기"용이고 이것만 "받기"용.

| 컬럼 | 한글 뜻 | 비고 |
|---|---|---|
| plan_id | 신청한 플랜 (FK) | |
| customer_name / phone | 신청자 이름 / 전화 | 개인정보 — 노출 금지 |
| pay_method | 결제수단 | kakao / toss / card |
| **amount** | **신청 시점 금액 스냅샷** | 나중에 플랜 가격이 바뀌어도 이 기록은 그대로 |
| status | 신청 상태 | pending(대기)→paid(결제)→active(이용중)→expired(만료)/canceled(취소) |
| start_date / end_date | 구독 시작일 / 종료일 | |
| session_id | 신청한 방문 세션 (FK) | 분석 영역과 연결되는 다리 — "어떤 경로로 들어온 사람이 결제했나" |

### news — 소식(공지)
소식 목록·상세 페이지.

| 컬럼 | 한글 뜻 | 화면 위치 |
|---|---|---|
| category | 구분 배지 | 목록의 '공지' |
| title | 제목 | |
| is_new | NEW 배지 여부 | |
| author | 작성자 | 까치커피바 |
| summary | 한 줄 요약 | 홈 소식 카드 문구 |
| body | 본문 (Markdown) | 상세 페이지 |
| image_url | 대표 이미지 | 상세 상단 |
| views | 조회수 | |
| published_at | 작성일(게시일) | 목록의 날짜 |

### guide_items — 이용안내 항목
홈 Guide 섹션의 01~06 안내문. 운영자가 수정할 일이 없으면 테이블 대신 코드 상수로 둬도 된다(현재 프론트도 상수).

---

## 2. 분석 스키마 — "누가 뭘 보고 어디로 갔나"

핵심 아이디어: 방문자마다 **세션(방문 1회)**을 만들고, 그 안에서 일어난 **이벤트(조회·클릭)**를 시간순으로 쌓는다. 나중에 시간순으로 다시 읽으면 이동 경로가 복원된다.

### analytics_sessions — 방문 세션
"손님 한 명이 문 열고 들어와서 나갈 때까지" 단위.

| 컬럼 | 한글 뜻 | 예시 |
|---|---|---|
| anonymous_id | 익명 방문자 식별자 | 쿠키 기반 — 이름 아님, 재방문 구분용 |
| referrer | 유입 출처 | 인스타그램에서 왔는지, 검색인지 |
| landing_path | 첫 진입 페이지 | '/' 또는 '/menu' |
| device / browser / os | 기기 / 브라우저 / 운영체제 | mobile / Chrome / iOS |
| utm_* | 광고 캠페인 추적 코드 | 어떤 광고 링크로 왔는지 |
| started_at / ended_at | 방문 시작 / 종료 시각 | |

### analytics_events — 이벤트 로그 (클릭스트림)
세션 안에서 일어난 행동 하나하나. **분석의 원재료.**

| 컬럼 | 한글 뜻 | 예시 |
|---|---|---|
| session_id | 소속 세션 (FK) | |
| event_type | 행동 종류 | page_view(화면 봄) / cta_click(버튼 클릭) / plan_select(플랜 선택) / pay_select(결제수단 선택) / subscribe_submit(신청 제출) |
| page_name | 화면 이름 | home / menu / news_list / news_detail / checkout |
| path | 실제 주소 | /news/1 |
| entity_type / entity_id | 대상 종류 / 대상 ID | news / 1 → "1번 소식을 봤다" |
| referrer_path | 직전 페이지 | 전이 분석의 핵심 — "어디서 넘어왔나" |
| properties | 자유 확장 데이터 (JSON) | 선택한 플랜, 결제수단 등 |
| occurred_at | 발생 시각 | 시간순 정렬 기준 |

---

## 3. 관계 한눈에 (ERD 읽는 법)

```
menu_categories ─< menu_items ─ home_signatures     (카테고리 안에 메뉴, 그중 일부가 홈 카드)
subscription_plans ─< subscriptions                  (플랜 하나에 신청 여러 건)
analytics_sessions ─< analytics_events              (세션 하나에 이벤트 여러 개)
subscriptions ─ analytics_sessions                  (신청 ↔ 방문 세션: 전환 추적 다리)
```

기호 뜻: `─<` = 1:N(하나가 여럿을 가짐), `||--o|` = 1:0~1(있을 수도 없을 수도).

---

## 4. 주요 설계 결정과 이유

1. **가격은 정수(원)로 저장** — 소수점 오차 원천 차단. "5,500원" 포맷은 화면(UI) 담당.
2. **금액 스냅샷(amount)** — 플랜 가격이 인상돼도 과거 신청 기록의 금액은 불변. 장부는 고쳐 쓰지 않는다.
3. **enum 대신 varchar + CHECK** — 결제수단 등 고정 값 목록에 enum을 쓰면 나중에 값 추가가 번거롭다. CHECK 제약은 한 줄 수정으로 끝.
4. **Signature 분리 테이블** — 상품 원본(메뉴판)과 마케팅 큐레이션(홈)의 관심사 분리.
5. **분석 로그는 append-only** — 이벤트는 쌓기만 하고 수정하지 않는다. 집계는 쿼리(window 함수)로.

---

## 5. 대표 분석 질문 → 쿼리 매핑

| 알고 싶은 것 | 사용 쿼리 (스키마 문서 4장) |
|---|---|
| A 페이지 본 다음 어디로 가나 | 4-1 페이지 전이 집계 (`lead()` 윈도우 함수) |
| 홈에서 이탈? 메뉴로? 구독으로? | 4-2 다음 행동 분포 |
| 홈→체크아웃→신청 전환율 | 4-3 퍼널 |
| 제일 많이 읽힌 소식 | 4-4 인기 소식 |
| 어느 화면에서 나가버리나 | 4-5 이탈 페이지 |
| 본 사람 중 실제 결제 비율 | 4-6 전환 연결 (subscriptions.session_id 조인) |

---

## 6. 운영 메모

- **이벤트 수집**: 프론트에서 페이지 이동 시 `page_view` 전송 (session_id + path + 직전 경로).
- **개인정보**: `subscriptions`의 이름·전화는 PII. 행동 로그(익명)와 분리 취급, RLS로 일반 사용자 조회 차단.
- **성능**: 분석 쿼리는 `analytics_events(session_id, occurred_at)` 인덱스가 생명. 데이터가 커지면 날짜 파티셔닝.
- **빠른 대안**: 직접 구축 대신 GA4/PostHog를 붙이고 핵심 전환만 DB에 남기는 하이브리드도 가능.
