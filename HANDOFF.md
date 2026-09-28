# Gold Plaza 인수인계 문서 (현재 상태 + 다음 작업)

이 문서는 지금까지 구현된 내용, 실제 DB 스키마와의 일치 여부, 그리고 다음에 이어서 만들 추가사항을 정리한 것이다. 다음 작업을 요청할 때 이 문서를 그대로 프롬프트 재료로 쓰면 된다.

## 1. 프로젝트 개요
- 금은방(귀금속) 매입 관리. Phase 1(로그인 + 입고)까지 구현.
- 하나의 서버를 여러 가게가 함께 쓰는 멀티테넌트. 모든 데이터는 shop_id로 분리되고, 백엔드가 로그인 토큰에서 shop_id를 확인해 자기 가게 것만 읽고 쓴다.
- 기술: Python 3.13 + FastAPI + Pydantic v2, Supabase(DB·Storage·Auth, service key로 접근), Gemini(google-genai SDK, 모델 gemini-2.5-flash), 프론트는 순수 html/js/css + PWA.
- 프론트는 백엔드가 함께 서빙(서버 하나). 실행은 Gold_plaza 폴더에서:
  `goldbusiness\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000`

## 2. 만든 파일과 역할
- backend/config.py — .env의 키 4개(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, GEMINI_API_KEY)를 dotenv로 읽음. 값이 없으면 무엇이 빠졌는지 알리고 멈춤.
- backend/field_config.py — 입고 필드 정의(품목명·분류·중량·순도·매입가·메모)와 Gemini 프롬프트 생성 함수를 한 곳에 모음. 업종 확장 대비.
- backend/db.py — service key로 Supabase 클라이언트 생성.
- backend/security.py — 공통 의존성 get_current_shop: 토큰 검증 → user_id → shop_members에서 shop_id 조회 → ShopContext 반환. 토큰 없음/만료 401, 소속 가게 없음 403, 전부 한국어 안내.
- backend/schemas.py — AIExtraction(AI 응답 검증, 모든 필드 Optional, category는 gold/silver/other가 아니면 None), IntakeConfirm(저장 요청 검증, shop_id는 안 받음. AI 자동수집값 ai_model/ai_latency_ms/ai_tokens_input/ai_tokens_output를 Optional로 받음. ai_was_edited는 안 받고 서버가 계산).
- backend/image_utils.py — Pillow로 EXIF 회전 보정 + RGB 변환 + 긴 변 1500px 리사이즈 + JPEG 품질 85 압축.
- backend/gemini.py — 압축 사진을 Gemini로 보내 글자 인식, JSON 파싱, 실패 시 1회 재시도, 그래도 실패면 한국어 502. (검증 결과, ai_raw 원본, meta) 3개 반환. meta는 ai_model/ai_latency_ms/ai_tokens_input/ai_tokens_output.
- backend/make_icons.py — Pillow로 PWA 아이콘(진한 금색 배경 + 흰색 金) icon-192/512.png를 frontend/에 생성하는 1회용 스크립트.
- backend/routers/intake.py — 입고 API 3개. confirm에서 ai_was_edited 계산 및 AI 자동수집 5개 값 저장.
- backend/main.py — 앱 조립 + 프론트 서빙 + /api/public-config, /api/me.
- frontend/index.html, app.js, style.css, manifest.json — 로그인·입고·확인팝업·목록 화면. app.js는 analyze로 받은 AI 자동수집값을 confirm 때 그대로 되돌려줌.
- frontend/icon-192.png, icon-512.png — PWA 홈 화면 아이콘(make_icons.py로 생성).
- 그 외: README.md(설치·실행·새 가게 발급법), requirements.txt, .env.example, .gitignore.

## 3. API 목록
- GET /api/public-config — 프론트 로그인용 supabase_url, anon_key 반환.
- GET /api/me — 로그인한 사장님의 shop_id, shop_name 반환.
- POST /api/intake/analyze — 사진 업로드 → 압축 → Storage 업로드(경로 {shop_id}/{연}/{월}/{uuid}.jpg) → Gemini 인식 → {photo_url, fields, ai_raw, ai_model, ai_latency_ms, ai_tokens_input, ai_tokens_output} 반환. DB 저장은 아직 안 함.
- POST /api/intake/confirm — 확정 데이터 + photo_url + ai_raw + AI 자동수집값을 intake_records에 insert. shop_id는 서버가 토큰에서 얻어 강제로 붙임. ai_was_edited는 서버가 ai_raw와 최종값을 비교해 계산.
- GET /api/intake/list — 내 가게 최근 20개(shop_id 필터, created_at 내림차순) + 사진 signed URL.

## 4. 실제 스키마와 맞는 부분 (확인 완료)
- shop_members에서 user_id로 shop_id 조회 방식 일치.
- shops.name을 /api/me에서 읽음.
- intake_records insert 컬럼(shop_id, item_name, category, weight_g, purity, purchase_price, memo, photo_url, ai_raw, ai_model, ai_latency_ms, ai_tokens_input, ai_tokens_output, ai_was_edited)이 전부 실제 컬럼과 일치. status는 기본값 in_stock, attributes는 기본값 {}로 자동 처리됨.
- category 값은 gold/silver/other만 보내서 check 제약과 안 부딪힘.
- Storage 버킷 이름·경로 규칙·비공개 signed URL 방식 일치.

## 5. 방금 고친 것
- 스키마의 item_name이 not null(필수)인데, 기존 화면은 품목명을 비워도 저장을 시도해서 DB가 거부하고 "저장 실패"만 떴음. 이제 품목명이 비어 있으면 저장 전에 "품목명을 입력해 주세요"로 막도록 frontend/app.js에 검증 추가. 브라우저 Ctrl+F5 새로고침으로 반영.

## 6. 아직 안 된 부분 / 누락 (정확히)
- outgo_records의 attributes/channel/토큰 컬럼도 미사용(출고는 Phase 2라 정상).
- 회원가입 화면 없음(원래 의도). DB 함수 create_shop_with_owner(p_user_id, p_shop_name, p_business_type default 'gold')는 준비돼 있어 붙이기만 하면 됨.
- outgo_records, expenses 테이블은 Phase 2·3용이라 백엔드 미구현(정상).

## 7. 완료된 추가사항 (2026-07-12 반영)
### 7-1. AI 분석 자동수집 — 완료
- intake_records의 ai_model, ai_latency_ms, ai_tokens_input, ai_tokens_output, ai_was_edited가 이제 입고 저장 시 자동으로 채워짐. (ERD 설계 원칙 4 "AI 품질·비용 자동 수집" 구현 완료)
- gemini.py: Gemini 호출 직전·직후 시간을 time.perf_counter로 재서 ai_latency_ms(정수 ms) 계산. 응답 usage_metadata에서 prompt_token_count → ai_tokens_input, candidates_token_count → ai_tokens_output 추출(없으면 null, 에러 안 냄). ai_model은 "gemini-2.5-flash". 이 값들을 meta로 묶어 (검증결과, ai_raw, meta) 3개로 반환.
- routers/intake.py: analyze 응답에 ai_model/ai_latency_ms/ai_tokens_input/ai_tokens_output를 함께 실어 보냄. 프론트(app.js)는 화면에 쓰지 않고 confirm 때 ai_raw와 같은 방식으로 그대로 되돌려줌.
- ai_was_edited는 프론트를 믿지 않고 백엔드 confirm에서 계산. ai_raw의 AI 추출값과 최종 저장값을 필드별 비교해 하나라도 다르면 true. 숫자 대 문자열("18.75") 타입 차이와 null↔빈칸을 정규화 후 비교해 오탐 방지(_normalize_for_compare, _compute_ai_was_edited).
- schemas.py: IntakeConfirm에 ai_model/ai_latency_ms/ai_tokens_input/ai_tokens_output를 Optional로 추가(ai_was_edited는 받지 않음, 서버가 계산).
- 검증법: 입고 1건 저장 후 Supabase Table Editor의 intake_records에서 위 5개 컬럼이 채워졌는지 확인. 값을 고쳐 저장하면 ai_was_edited=true, 안 고치면 false.

### 7-2. PWA 아이콘 — 완료
- icon-192.png, icon-512.png 없어서 뜨던 404 경고 해결. backend/make_icons.py(Pillow로 진한 금색 배경 + 흰색 金 생성)로 frontend/에 두 파일 생성 완료. manifest.json 경로(/icon-192.png, /icon-512.png)와 일치.

### 7-3. 신뢰성 기능 — 조회·상세·수정이력·안전삭제 (Phase 1.5) — 완료
- 목적: "이 앱은 내 장부다"라는 신뢰. 기록은 사라지지 않고(소프트 삭제), 언제든 찾을 수 있고(검색), 고친 흔적이 남는다(감사 로그).
- 전제 DB 변경(마이그레이션은 이미 반영됨): intake_records에 updated_at, deleted_at(null=정상) 추가. audit_logs 테이블 신설(id, shop_id, table_name, record_id, action[create/update/delete/restore], before_data jsonb, after_data jsonb, user_id, created_at).
- backend/audit.py: write_audit_log()로 audit_logs에 한 줄 남김. 이력 기록 실패가 본 작업(저장/수정 등)을 실패시키지 않도록 예외를 삼키고 경고 로그만 남김(읽기 전용 이력 원칙).
- backend/schemas.py: IntakeUpdate 추가(6개 필드, item_name 필수·공백거부, category 검증).
- backend/routers/intake.py 확장:
  - GET /api/intake/list — q(품목명 부분일치 ilike), category, start_date, end_date, offset(20단위), trash(기본 false=정상만, true=삭제된 것만) 파라미터. PAGE_SIZE(20)+1개를 range로 가져와 has_more 판단. 응답에 deleted_at 포함.
  - GET /api/intake/{id} — 단건 상세. shop_id로 소유권 검증(없거나 남의 것이면 404). 사진 signed URL + audit_logs 이력(history) 함께 반환. 삭제된 것도 조회 가능(복구 전 확인용).
  - PATCH /api/intake/{id} — 수정. 수정 전 값 확보→update+updated_at 갱신→audit 'update'(before/after 전체값). 삭제된 것은 수정 불가(only_alive).
  - DELETE /api/intake/{id} — 소프트 삭제(deleted_at=now())+audit 'delete'. 실제 삭제 안 함.
  - POST /api/intake/{id}/restore — deleted_at=null 복구+audit 'restore'. 삭제 상태(only_deleted)만 대상.
  - confirm(신규 저장)에도 audit 'create' 추가.
  - 라우트 등록 순서 중요: /list가 /{id}보다 먼저여야 함(확인됨).
  - 공통 도우미 _fetch_owned_record(only_alive/only_deleted)로 소유권+생존여부 검증.
- 프론트(index.html, app.js, style.css):
  - 메인: 검색창 + [전체/금/은/기타] 필터 + 기간 선택 + "더 보기" + "휴지통 보기" 토글. 목록은 카드형(64px 썸네일, 품목명 18px 굵게, 중량·매입가, 분류 뱃지[금=금색/은=회색/기타=파랑], 삭제됨=빨간 취소선). 빈 목록 안내 문구.
  - 상세 화면(#detail-screen): 사진 크게(탭→원본 확대 오버레이), 전체 필드, 입고 시각, ai_was_edited면 "AI 인식 결과를 사장님이 수정함" 표시, 수정 이력 접기 영역(details), 하단 [수정][삭제] 또는(휴지통) [복구].
  - 수정 팝업(#edit-modal, e-* 필드): PATCH 호출. 저장 후 상세 재조회로 이력 갱신.
  - 삭제 전 confirm 대화상자("정말 삭제할까요? 기록은 휴지통에 보관됩니다").
  - 알림 배너(#banner): 성공 초록 2초/실패 빨강 4초. 저장·수정·삭제·복구 성공 시 "✓ ...되었습니다".
  - 이중 저장 방지: withBusy()로 네트워크 동안 버튼 잠금+글자 변경.
  - 디자인: 네이비(#1a2744) 헤더 + 금색(#c9a227) 포인트, 흰 본문. 글자 16px+/버튼 48px+ 유지.
- 검증(코드 레벨 완료): 전 파일 py_compile/node --check 통과, 앱 임포트·기동 정상, 7개 라우트 순서 정상, 검문소 401, ai_was_edited 회귀 정상. ※ WSL2↔Windows 네트워크 제약으로 브라우저 실사용 확인은 Windows에서 uvicorn 실행 후 직접 해볼 것.
- 하지 않은 것(지시대로): audit_logs 수정/삭제 API 없음(읽기 전용), 하드 삭제 없음, 회원가입 없음.

### 7-4. Phase 2 — 출고(판매) + 재고 자동 차감 — 완료
- 목적: 재고(intake_records, status='in_stock')를 판매 처리하고 판매가를 outgo_records에 기록. Phase 3 순이익 그래프의 재료.
- 판매 취소 방식(사전 확정): outgo_records에는 deleted_at이 없고 마이그레이션 금지라, 소프트 삭제 대신 '소프트 취소'를 씀. outgo 행은 그대로 두고 attributes(jsonb)에 cancelled_at를 적어 표시. 목록/상세 조회는 attributes->>cancelled_at is null(취소 안 됨)만 보여줌.
- backend/field_config.py: OUTGO_CHANNEL_OPTIONS/VALUES(store=매장/phone=전화/other=기타) 추가.
- backend/schemas.py: OutgoConfirm(intake_id 필수, sale_price 필수·양수, channel 선택·허용값 검증, memo 선택. shop_id는 안 받음).
- backend/routers/outgo.py 신설(prefix /api/outgo). intake 라우터의 _make_signed_url, PAGE_SIZE 재사용:
  - POST /confirm: 재고 확인(내 가게+삭제안됨+in_stock, 이미 sold면 409 "이미 판매된 물건입니다") → outgo insert → intake.status='sold'+updated_at → audit 'update'(intake 상태변화)+'create'(outgo). 상태변경 실패 시 방금 넣은 outgo를 삭제 롤백(_rollback_outgo).
  - GET /list: 취소 안 된 판매만(attributes->>cancelled_at is null), intake_records 임베드로 품목명·분류·중량·매입가·사진을 함께 끌어와 평평하게 정리, margin=sale_price−purchase_price 계산, 20개 페이지네이션(has_more).
  - POST /{id}/cancel: 이미 취소면 409. attributes에 cancelled_at 병합(기존값 보존) → intake.status='in_stock'+updated_at → audit 'update'(outgo 취소)+'update'(intake 복귀).
- backend/routers/intake.py 수정: list에 status 파라미터(in_stock/sold) 추가(재고 탭이 status=in_stock 보냄), select에 status 포함. 상세(get_record) 응답에 sale 추가(sold면 취소 안 된 outgo 1건을 outgo_id/sale_price/channel/memo/sold_at로).
- backend/main.py: outgo 라우터 include.
- 프론트(index.html, app.js, style.css):
  - 목록 상단 [재고 | 판매됨 | 휴지통] 3분할 세그먼트(기존 휴지통 텍스트 토글 대체). listState.view = stock/sold/trash. 판매됨 탭에선 검색/분류/기간 컨트롤(#list-controls) 숨김.
  - 재고: /api/intake/list?status=in_stock. 카드에 [판매] 버튼(이벤트 위임+stopPropagation, cardData로 품목명·매입가 보관). 판매됨: /api/outgo/list, 카드에 판매가·판매일·마진(+초록 −빨강). 휴지통: 기존과 동일.
  - 판매 팝업(#sale-modal): 판매가(필수·숫자), 판매 경로(매장/전화/기타), 메모. '예상 마진=판매가−매입가'를 입력 즉시 실시간 표시(색상). withBusy로 이중 저장 방지. 성공 시 배너.
  - 상세: 재고면 [판매][수정][삭제], 판매됨이면 판매정보 박스(판매가·마진·경로·시각·메모)+[판매 취소](confirm 대화상자 후), 휴지통이면 [복구]. 판매됨 카드 탭은 intake_id로 상세를 엶.
  - 판매/판매취소 성공 배너 "✓ 판매 처리되었습니다"/"✓ 판매가 취소되었습니다".
- 검증(코드 레벨 완료): 전 파일 py_compile/node --check 통과, 앱 임포트 정상, 라우트 10개(intake 7+outgo 3), OutgoConfirm 검증(정상/0원거부/잘못된채널거부/intake_id누락거부) 정상, app.js의 모든 id 참조가 index.html에 존재(detail-*는 상세에 동적 생성). 실제 판매/취소 왕복은 DB·네트워크 필요 → Windows에서 실행 후 확인.
- 주의(런타임 위험 1곳): 취소 필터/조회에 PostgREST jsonb 필터 attributes->>cancelled_at=is.null을 씀(supabase-py .is_("attributes->>cancelled_at","null")). 표준 지원 문법이지만 실사용 시 판매됨 목록이 비거나 오류가 나면 이 필터부터 점검할 것.
- 이번에 안 한 것(지시대로): 정산·그래프(Phase 3), 출고 사진 촬영/AI 인식(재고에서 고르는 방식), 금 시세.

### 7-5. Phase 3 — 정산(순이익·그래프·엑셀) — 완료
- 목적: "이번 달 얼마 벌었나"를 숫자·그래프로 한눈에. 핵심 공식: 순이익 = 마진 합(판매가−연결 입고의 매입가) − 기간 내 비용 합(expenses). 취소된 판매(attributes->>cancelled_at 있음)와 삭제된 입고(deleted_at 있음)는 모든 집계에서 제외.
- 비용 삭제 방식(사전 확정): expenses엔 deleted_at/attributes가 없고 마이그레이션 금지라 소프트 삭제 불가. 그래서 실삭제하되 삭제 직전 전체값을 audit_logs(action='delete', before_data)에 남겨 감사로그로 보존.
- 히트맵 방식(내가 정함): Chart.js는 히트맵(matrix) 기본 미지원이라 별도 플러그인 CDN이 필요 → 의존성 늘리지 않으려고 7×8 CSS 그리드에 색 농도(금색 alpha)로 표현. 선그래프·도넛만 Chart.js.
- 시간대: created_at은 UTC 저장. 한국은 서머타임이 없어 UTC+9 고정으로 변환(reporting.KST). 기간(한국 날짜)→UTC 경계로 판매를 거르고, 판매시각을 한국시간으로 되돌려 일자/요일/시간대 계산.
- backend/reporting.py 신설(공용 집계): KST 변환(kst_range_to_utc/to_kst), fetch_sales(취소·삭제입고 제외 + 매입가 임베드 + 마진 계산), fetch_expenses(spent_at 기간), summarize(매출/마진/비용/순이익), previous_period(직전 동일길이 기간), percent_change.
- backend/schemas.py: ExpenseCreate(name 필수·공백거부, amount 필수·양수, spent_at 선택, memo 선택).
- backend/routers/report.py 신설(/api/report): summary(4종+전기간 대비 change%), daily(기간 내 모든 날짜 채워 매출·순이익 배열), heatmap(요일0=월..6=일 × 3시간 8칸 matrix+max), category(금/은/기타 매출), excel(openpyxl로 시트 2개 '판매내역'/'비용'+합계행, 한글 파일명 RFC5987 인코딩, openpyxl 없으면 501). start/end는 필수 쿼리(YYYY-MM-DD), 형식 오류 400.
- backend/routers/expenses.py 신설(/api/expenses): GET(기간 목록), POST(추가+audit create), DELETE(실삭제+audit delete).
- backend/main.py: report·expenses 라우터 include. requirements.txt: openpyxl>=3.1.0 추가.
- 프론트(index.html, app.js, style.css):
  - 하단 탭 바 [입고 | 정산](로그인 후 목록·정산 화면에서만 표시). 정산 화면(#report-screen) 신설.
  - 기간 선택 [이번 달|지난 달|최근 7일|직접], 요약 카드 4개(매출/마진/비용/순이익 크게·색상, 각 전기간 대비 ▲▼%), 그래프 3개(Chart.js 선그래프=일별 매출·순이익, CSS그리드 히트맵, Chart.js 도넛=분류별), 비용 목록+[비용 추가] 팝업+[삭제], [엑셀 내보내기](fetch로 blob 받아 다운로드).
  - Chart.js는 index.html에서 jsdelivr CDN으로 로드. 그래프 다시 그릴 때 이전 차트 destroy.
- 검증(코드 레벨): 전 파일 py_compile/node --check 통과, 앱 조립 정상(총 API 18개), reporting 단위검산 통과(아래 검산표와 일치), app.js의 모든 정적 id가 index.html에 존재(detail-*만 동적). 실제 그래프·엑셀·집계 왕복은 DB·네트워크 필요 → Windows 실행 후 확인.
- ★ 검산 절차(반드시 확인): 테스트 데이터 전체 기간 집계 시 — 매출 870,000(390,000+480,000), 마진 160,000(80,000+80,000), 비용 874,000(세공비35,000+감정비20,000+포장재15,000+월세800,000+택배4,000), 순이익 = 160,000 − 874,000 = −714,000(적자). 구현 숫자가 이와 다르면 집계 쿼리 버그. (reporting.summarize를 이 값들로 단위테스트해 일치 확인함.)
- 주의: 엑셀은 openpyxl 필요 → 미설치 시 [엑셀 내보내기]가 "openpyxl 설치 필요"(501)를 반환. 설치: goldbusiness\Scripts\python.exe -m pip install openpyxl. 취소판매 제외 필터는 Phase 2와 같은 jsonb attributes->>cancelled_at=is.null 사용(런타임 이상 시 이 필터부터 점검).
- 이번에 안 한 것(지시대로): 금 시세 연동(Phase 4), 회원가입, 전 가게 통합 통계(관리자용).

### 7-6. Phase 4-A — 배포 준비(Render 무료) — 완료
- 목적: 개발 PC 없이도 클라우드에서 앱이 계속 돌아가게. 배포처는 비교 후 사용자가 Render 무료로 선택(카드 불필요·자동 HTTPS·GitHub 연결만, 단 15분 유휴 시 잠들기 30~60초).
- 만든 파일:
  - render.yaml (Blueprint): web/python/free, region singapore, buildCommand pip install -r requirements.txt, startCommand `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`, PYTHON_VERSION 3.13.4. 비밀키 4개는 sync:false(값은 대시보드에서만 입력, git에 안 올림).
  - .env.example: 키 4개 견본(로컬은 .env, 배포는 Render Environment).
  - README.md 신설: 로컬 실행 / 환경변수 / 배포 절차(git init→GitHub→Render Blueprint→환경변수→확인) / 코드수정→push→자동반영 / 스모크 테스트 체크리스트 / 사장님용 잠들기 안내 문구 / CORS·HTTPS 메모.
  - requirements.txt에 openpyxl 이미 포함(클라우드 빌드에서 자동 설치 → 엑셀 로컬 미설치여도 배포본은 동작).
- 코드 변경 없음(이미 배포 친화적): 모든 프론트 fetch가 상대경로(/api/...), 포트/localhost 하드코딩 없음, config는 os.getenv로 Render 환경변수 읽음, 키 값은 로그에 안 찍힘(이름만), 프론트/백엔드 단일 출처라 CORS 불필요, StaticFiles가 프론트 서빙.
- 검증(코드 레벨): render.yaml YAML 유효, .env/goldbusiness/__pycache__/계정*.txt는 .gitignore로 제외됨, 하드코딩 호스트 없음.
- 사용자가 직접 할 일: git init + GitHub 저장소 + Render Blueprint 연결 + 대시보드에 키 4개 입력. push 전 git status로 .env 미포함 확인.
- 주의: requirements는 >= 하한이라(재현성 필요 시 == 고정 가능, requirements.txt 주석에 검증버전 있음). PWA는 manifest+아이콘만 있고 서비스워커는 없음(홈 화면 추가는 되나 오프라인 완전지원 아님).

### 7-7. Phase 5-A — 업종별 설정 시스템(하드코딩 제거) — 완료
- 목적: 분류·필드·Gemini 프롬프트를 shops.business_type 기반 설정으로 전환. 새 업종 추가 = field_config.py의 BUSINESS_CONFIGS에 설정 한 덩어리 추가만으로 끝.
- DB 전제(이미 반영): intake_records.category의 check 제약 제거됨 → 분류 허용값 검증은 백엔드가 업종 설정 기준으로 수행.
- backend/field_config.py 재구성: BUSINESS_CONFIGS = { gold(금은방), luxury(중고명품, 검증용) }. 각 업종은 label/categories([{value,label,color,text}])/fields([{key,label,type,ai_hint,options?}])/card_fields/prompt_intro. 저장 위치는 INTAKE_COLUMN_KEYS(item_name,category,weight_g,purity,purchase_price,memo)로 자동 판별 → 그 밖 필드(brand/model/grade)는 attributes(jsonb). 도우미: get_business_config/category_values/field_store/compare_fields/public_config(프론트용, ai_hint 제외)/clean_ai_fields/build_extraction_prompt(업종별). 하위호환 별칭 CATEGORY_OPTIONS/CATEGORY_VALUES(gold)도 남김.
- backend/security.py: ShopContext에 business_type 추가(shop_members에서 shops(business_type) 임베드로 가져옴, 없으면 None→설정이 기본 gold로 대체).
- backend/main.py /api/me: business_type + config(public_config) 함께 반환.
- backend/gemini.py: analyze_image(image_bytes, prompt) — 프롬프트를 인자로 받고 원본 dict만 반환(AIExtraction 제거). 정리는 라우터에서.
- backend/schemas.py: IntakeConfirm/IntakeUpdate를 fields(dict) 하나로 받도록 변경(고정 항목 제거). 분류/품목명 검증은 라우터로 이동. AIExtraction 삭제.
- backend/routers/intake.py: _build_intake_payload(business_type, fields)로 fields를 컬럼/attributes로 분리+검증(품목명 필수·분류 허용값 아니면 422, 설정에 정의된 키만 저장=임의 키 금지). analyze는 업종 프롬프트+clean_ai_fields. confirm/patch는 컬럼+attributes 저장. _compute_ai_was_edited는 compare_fields(업종)로 일반화. list select에 attributes 추가.
- backend/routers/report.py: category 도넛/엑셀 라벨을 업종 categories 기준으로. category 응답에 color 포함.
- 프론트(index.html, app.js, style.css): /api/me의 config로 렌더링. 분류 필터 버튼(#filter-row)·확인/수정 팝업 필드(#confirm-fields/#edit-fields, cf-/ef- prefix)·뱃지 색(인라인 style)·카드 하위표시(card_fields)·상세 필드표·수정이력 diff·정산 도넛 색까지 전부 설정 기반. js에 '금/은/gold' 하드코딩 없음(요일 '금'만 예외). renderFieldForm/readFieldForm으로 동적 폼, readFieldValue로 컬럼/attributes 구분.
- 검증(코드 레벨): 전 파일 py_compile/node --check 통과, 앱 조립(18라우트). 단위검증 — gold의 _build_intake_payload 컬럼 6개+attributes{}로 '이전과 동일'(회귀 없음), luxury는 columns{item_name,category,purchase_price,memo}+attributes{brand,model,grade}, 잘못된 분류/빈 품목명 422, ai_was_edited same=False/diff=True, clean_ai_fields가 정의외 키 제거·분류 이상값 None. 실제 DB 왕복/화면은 Windows에서 확인 필요.
- luxury 가게 만드는 법: backend.create_shop 실행 시 '업종'에 luxury 입력(엔터로 넘기면 gold). shops.business_type check 제약 없어 luxury 저장됨. 로그인하면 버튼 [전체|가방|시계|쥬얼리|기타], 팝업 필드 브랜드·모델명·상태등급으로 바뀜.
- 안 한 것(지시대로): 업종 전환 UI(발급 때 고정), DB 컬럼 추가, 회원가입.

## 8. 다음에 이어서 할 추가사항 (구현 힌트 포함)
### 8-1. (선택) 회원가입
- 백엔드에 엔드포인트를 만들어, supabase.auth.signUp으로 계정 생성 후 rpc로 create_shop_with_owner(가입자ID, 가게이름, 'gold') 호출.
- 프론트에 가게이름·이메일·비밀번호 입력 화면 추가하고 가입 후 자동 로그인.
- 단, Supabase에서 이메일 인증(Auto Confirm) 설정을 꺼야 바로 로그인됨.

## 9. 실행 환경 메모
- 가상환경 goldbusiness(윈도우, Python 3.13)에 fastapi, uvicorn, supabase 2.31, google-genai 2.11, pillow 12.3, python-dotenv, python-multipart 설치됨.
- .env에 키 4개 채워져 있음(진짜 키는 .env에만, .env.example에는 견본만).
- 반드시 Gold_plaza 폴더 안에서 위 실행 명령으로 켬.

## 10. 참고: 실제 DB 스키마 (현재 상태)
- shops: id, name, business_type(default 'gold'), created_at, address, phone(전화번호, Phase 1.5 발급 시 필수 입력)
- shop_members: user_id(PK, FK auth.users), shop_id(FK shops), role(default 'owner'), created_at
- intake_records: id, shop_id, item_name(not null), category(default 'other', check gold/silver/other), weight_g numeric(10,3), purity, purchase_price bigint, memo, photo_url, ai_raw jsonb, status(default 'in_stock', check in_stock/sold), created_at, attributes jsonb default '{}', ai_model, ai_latency_ms, ai_was_edited, ai_tokens_input, ai_tokens_output
- outgo_records: id, shop_id, intake_id(FK), sale_price(not null), photo_url, ai_raw, memo, created_at, attributes, channel, ai_tokens_input, ai_tokens_output
- expenses: id, shop_id, name, amount, memo, spent_at(default current_date), created_at
- 전 테이블 RLS 활성화(정책 없음) → 백엔드 service key로만 접근, 코드에서 shop_id 강제 필터.
- Storage 버킷 intake-photos(비공개).
- 함수 create_shop_with_owner(p_user_id, p_shop_name, p_business_type default 'gold') returns uuid, security definer.
