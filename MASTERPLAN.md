# 매입장부 플랫폼 설계도 (MASTERPLAN)

이 문서는 3업종군(재고형·회원형·제조형) 플랫폼의 전체 설계도입니다. 1탄에서 만든 것은 "업종군 분기 뼈대"와 이 문서뿐이고, 회원형·제조형의 실제 기능은 아직 없습니다. 이 문서는 사장님이 검토·수정 지시하기 위한 초안이며, 여기 적힌 테이블·화면·API는 확정이 아니라 제안입니다.

## 0. 큰 그림 — 3층 구조

- 1층 공통 플랫폼(모두 공유): 로그인, 가게별 데이터 분리(멀티테넌트, shop_id), 사진 업로드와 signed URL, 사진에서 AI 읽기(Gemini), 정산 리포트 골격, 감사 로그, 소프트 삭제, 알림(신설 예정).
- 2층 업종군 모듈(여기서 화면·데이터가 갈림): retail(재고형, 완성) / membership(회원형, 예정) / manufacturing(제조형, 예정).
- 3층 업종 세부설정: business_type(gold·watch 등)과 가게가 만든 분류(shop_categories).

핵심 원칙: 하나의 표에 다 담지도 말고, 완전히 따로 노는 세 앱을 만들지도 말자. 공통 토대는 재활용하고 화면·데이터만 갈라지게 한다.

## 0.5 1탄에서 실제로 만든 것 (현재 상태)

- backend/families.py: 업종군 정의(BUSINESS_FAMILIES)와 세부 업종→업종군 판별(family_of).
- /api/me 응답에 business_family 추가. 세부 업종으로 자동 판별하고, 매핑에 없으면 null(미정).
- 프론트: 로그인 후 enterApp()이 업종군을 보고 분기. retail이면 기존 앱, membership·manufacturing이면 "준비 중" 화면, 미정이면 "업종군 선택" 화면.
- 미정 계정: create_shop 발급 때 업종을 '미정'으로 넣으면 business_type이 "unset"이 되어 선택 화면이 뜬다. 사장님이 고른 값은 지금은 브라우저(localStorage)에 임시 저장한다.
- retail(기존 앱)은 손대지 않아 회귀 없음.

이 단계의 임시 결정(2탄 전에 정리 대상): 미정 계정이 고른 업종군을 localStorage에만 두는 것은 임시다. 기기를 바꾸면 다시 골라야 하므로, 영구 저장(예: shops.business_family 컬럼) 방식을 2탄 시작 전에 정한다.

---

## 1. 회원형(membership) 모듈 설계

대상: 헬스장, 태권도장, 학원, 필라테스 등. 핵심은 "회원을 등록받고 → 회원권을 팔고 → 출석을 받고 → 회비를 걷고 → 만료 전에 재등록시키는" 흐름이다. 재고·마진 개념이 없고 사람(회원)과 기간이 중심이다.

### 1-1. 테이블 초안

모든 테이블은 shop_id로 가게를 분리하고, 소프트 삭제(deleted_at)와 감사 로그 대상으로 둔다(공통 토대 재사용).

- members(회원): id, shop_id, name, phone, birth, gender, photo_url, memo, joined_at, deleted_at, created_at
- membership_plans(회원권 상품): id, shop_id, name(예: 3개월권/10회권), kind('period' 기간권 | 'count' 횟수권), duration_days, count, price, is_active, sort_order
- memberships(회원이 산 회원권): id, shop_id, member_id, plan_id, start_date, end_date, remaining_count, status('active'|'expired'|'paused'), price_paid, created_at
- attendances(출석): id, shop_id, member_id, membership_id, checked_at, method('manual'|'qr'), created_at
- payments(회비 결제·미납 이력): id, shop_id, member_id, membership_id, amount, due_date, paid_at, status('paid'|'unpaid'|'overdue'), method, memo

설계 메모: 결제 상태를 memberships에 요약으로 둘지, payments를 별도 이력으로 둘지는 2탄 착수 때 확정. 초안은 payments를 이력으로 두고 미납/연체를 여기서 계산.

### 1-2. 화면 목록

- 회원 목록·검색, 회원 상세(회원권·출석·결제 이력 한 화면)
- 회원 등록(사진 촬영 포함)
- 회원권 상품 관리(기간권/횟수권 만들기)
- 회원권 판매(회원에게 회원권 부여, 시작·만료일 자동 계산)
- 출석 체크(오늘 출석 명단, 수동 체크 또는 QR)
- 만료 임박·미납 대시보드
- 회원형 정산(매출=회비, 재등록률 등)

### 1-3. API 목록(초안)

- GET/POST /api/members, GET/PATCH/DELETE /api/members/{id}
- GET/POST /api/membership-plans, PATCH /api/membership-plans/{id}
- POST /api/memberships(회원권 판매), PATCH /api/memberships/{id}(연장·일시정지)
- POST /api/attendances(출석 체크), GET /api/attendances?date=
- GET /api/members/expiring(만료 임박), GET /api/payments/overdue(미납)

### 1-4. 공통 토대에서 재사용할 것

- 인증·검문소(CurrentShop)와 shop_id 격리 패턴 그대로.
- 사진 업로드·압축·signed URL(회원 사진에 사용).
- 감사 로그(write_audit_log), 소프트 삭제 패턴.
- 정산 리포트 골격(지표만 회비·재등록률로 교체).
- 알림 인프라(신설): 만료 임박·미납 안내.

---

## 2. 제조형(manufacturing) 모듈 설계

대상: 음식점, 공방, 공장 등. 핵심은 "원재료를 여러 개 소비해서 다른 완제품을 만들어 판다"이다. 재고형의 대전제(산 것 = 파는 것, 1:1)가 깨지고, N개 재료 → 1개 완제품 + 재료 재고 차감 + 원가(재료비 합) 계산이 필요하다. 세 모듈 중 데이터가 가장 복잡하다.

### 2-1. 핵심 개념

원재료 재고 / 레시피(BOM, 완제품 1개당 재료 소요량) / 생산(레시피대로 재료 차감) / 원가(들어간 재료비 합).

### 2-2. 테이블 초안

- materials(원재료): id, shop_id, name, unit('g'|'개'|'ml' 등), stock_qty, avg_cost(평균 단가), photo_url, memo, deleted_at, created_at
- material_intakes(원재료 입고): id, shop_id, material_id, qty, unit_cost, total_cost, supplier, photo_url(납품서), source('ai'|'manual'), created_at  → 입고 시 materials.stock_qty를 늘리고 avg_cost를 갱신
- products(완제품·메뉴): id, shop_id, name, sell_price, category, photo_url, is_active
- recipes(BOM): id, shop_id, product_id, material_id, qty(완제품 1개당 재료 소요량)
- productions(생산): id, shop_id, product_id, qty, produced_at, cost(계산된 재료비 합), created_at  → 생산 시 recipes대로 materials.stock_qty를 차감. 제조업은 완제품 재고를 쌓고, 음식점은 판매 즉시 소진
- product_sales(완제품 판매): id, shop_id, product_id, qty, sale_price, cost, margin, sold_at

설계 메모: 음식점(즉석 판매)과 제조업(배치 생산 후 완제품 재고)은 판매 쪽이 다르다. 완제품 재고를 productions/product_sales로 계산할지 별도 재고 테이블을 둘지는 2탄 후 3탄 착수 때 타깃(음식점/제조업)을 정해 확정.

### 2-3. 납품서 사진 → AI → 재료 입고 흐름

1. 납품서·영수증 사진 촬영 → POST /api/materials/analyze
2. AI가 여러 줄(품목명·수량·단가)을 한꺼번에 추출한다. 기존 입고 analyze는 물건 1건이지만, 여기서는 표처럼 여러 줄을 읽는 것이 새로운 점이다.
3. 사장님이 확인·수정 화면에서 줄별로 손보고 저장 → 각 줄을 material_intakes로 넣고 materials의 재고·평균 단가를 갱신한다.

### 2-4. API 목록(초안)

- GET/POST /api/materials, PATCH/DELETE /api/materials/{id}
- POST /api/materials/analyze(납품서 사진 → 여러 줄 추출), POST /api/material-intakes(확정 저장)
- GET/POST /api/products, PATCH/DELETE /api/products/{id}
- GET/POST/PATCH/DELETE /api/recipes(BOM 편집)
- POST /api/productions(생산 → 재료 차감 + 원가 계산)
- POST /api/product-sales, GET 원가·마진 리포트

### 2-5. 공통 토대에서 재사용할 것

- 인증·shop_id 격리, 감사 로그, 소프트 삭제.
- 사진 AI. 단, '여러 줄(납품서)' 추출을 지원하도록 확장 필요(2-3 참고).
- 정산 골격(지표를 원가·생산량·재료 회전으로 교체).
- 알림(재료 소진 임박).

---

## 3. 공통 토대 정비 목록 (두 모듈을 붙이기 전에 손볼 것)

- 업종군 단일 소스화: 지금은 families.py(백엔드)와 프론트의 카드가 각각 3업종군을 갖고 있다. 드리프트를 막게 프론트가 목록을 백엔드에서 받도록(또는 한 곳에서만 정의) 정리.
- 미정 계정의 업종군 영구 저장: localStorage 임시 → shops.business_family 컬럼 등 영구화 방식 확정(마이그레이션은 사장님이 실행).
- 프론트 화면 로더 구조화: 업종군이 늘면 app.js가 비대해진다. 업종군별로 화면·로직 파일을 나누는(모듈 로더) 구조를 도입.
- 사진 AI 확장: 지금은 물건 1건 추출. 제조형 납품서용 '여러 줄' 추출 경로를 공통 gemini 계층에 추가.
- 정산 리포트 일반화: 재고형=마진, 회원형=회비·재등록률, 제조형=원가·생산량. 리포트 골격을 지표 교체가 쉽게 일반화.
- 알림 인프라 신설(공통): 만료·미납·재료 소진·정산 요약. 발송 수단(앱내 알림=무료 / 문자·카톡=유료 연동)은 결정 필요.
- 감사 로그·소프트 삭제를 새 테이블(members·materials 등)에도 일관 적용.

---

## 4. 구현 순서 제안 (2탄·3탄 작업 단위 + 완료 기준)

각 단위의 공통 완료 기준: 코드 작성 → 실제 앱에서 시연 → 회귀 확인(retail 및 이미 만든 부분에 영향 없음) → shop_id 격리·감사 로그 적용.

### 2탄 — 회원형 (쉬운 것부터)

- 2-1 회원 CRUD + 목록·검색·상세. 완료 기준: 회원 등록·수정·소프트삭제·검색이 되고, 다른 가게 회원이 안 보이며, 감사 로그가 남는다.
- 2-2 회원권 상품 + 회원권 판매. 완료 기준: 기간권/횟수권 상품을 만들고, 회원에게 부여하면 시작·만료일(또는 잔여 횟수)이 자동 계산된다.
- 2-3 출석 체크. 완료 기준: 오늘 출석 명단에서 체크·취소가 되고, 횟수권이면 잔여 횟수가 줄어든다.
- 2-4 만료 임박·미납 대시보드 + 알림. 완료 기준: 임박·미납 목록이 정확히 뜨고, 알림이 발송된다(수단은 3번에서 결정한 것).
- 2-5 회원형 정산. 완료 기준: 회비 매출과 재등록률 지표가 기간별로 나온다.

### 3탄 — 제조형 (복잡, 뒤로)

- 3-1 원재료 재고 CRUD. 완료 기준: 재료 등록·수정, 수량·평균 단가 표시.
- 3-2 납품서 사진 → AI 여러 줄 입고. 완료 기준: 사진 한 장에서 여러 품목을 뽑아 확인·수정 후 재고에 반영, 평균 단가 갱신.
- 3-3 완제품 + 레시피(BOM) 편집. 완료 기준: 완제품별 재료 조합을 저장·수정.
- 3-4 생산 처리(재료 차감 + 원가). 완료 기준: 생산 수량을 넣으면 레시피대로 재료가 자동 차감되고 원가가 계산되며, 재료가 모자라면 막는다(음수 재고 방지).
- 3-5 완제품 판매 + 제조형 정산. 완료 기준: 판매가 되고 마진(판매가−원가)이 계산되며, 재료 소진 임박 알림이 뜬다.

---

## 5. 리스크·미결정 목록

- 미정 계정 업종군 영구 저장(DB 컬럼) 여부와 방식.
- 알림 발송 수단: 앱내 알림(무료)만 할지, 문자·카톡(유료 연동)까지 갈지.
- 음식점 vs 제조업의 판매 UX 차이(즉석 판매 vs 배치 생산 후 재고).
- app.js 비대화 → 업종군별 파일 분리 시점.
- 셀프 회원가입·결제는 이 로드맵 밖(별도 탄). 유료 서비스화 시점에 다룬다.
