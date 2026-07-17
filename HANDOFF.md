# 까치커피바 (GGACHI COFFEE BAR) — Engineering Handoff

브랜드 웹사이트 풀스택 프로젝트. 이 문서 하나로 온보딩하고 로컬에서 띄울 수 있도록 정리했다.

- **상태**: 프론트엔드 UI 5개 화면 구현 완료 · 백엔드 API 완료 · **Supabase 연결 완료(스키마 적용됨)** · 콘텐츠 전 화면 DB 연동 완료
- **스택**: React (Vite) / Flask (SQLAlchemy) / Supabase (PostgreSQL)
- **디자인 소스**: Figma (1440px 데스크톱)

---

## 1. TL;DR (5분 안에 띄우기)

```bash
# 백엔드 먼저 (backend/.env 는 이미 채워져 있음)
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
flask --app wsgi init-db                        # 처음 1회: 콘텐츠 시드 삽입
python wsgi.py                                  # http://localhost:5000

# 프론트엔드 (다른 터미널)
cd frontend && npm install && npm run dev       # http://localhost:5173
```

콘텐츠는 전부 DB에서 오므로 **백엔드가 떠 있어야 화면에 내용이 보인다.**
백엔드가 없으면 각 영역에 "콘텐츠를 불러오지 못했습니다" 안내가 뜬다(화면이 깨지지는 않음).

---

## 2. 아키텍처

```
Browser
  │
  ▼
React (Vite dev server :5173)
  │   fetch('/api/...')  ── Vite proxy ──▶  Flask (:5000)
  │                                            │
  │                                            ▼
  └── 콘텐츠 사본 없음                        SQLAlchemy ──▶ Supabase (PostgreSQL)
      (로딩/실패 상태만 처리)                              (postgres 롤 = RLS 우회)
```

- **콘텐츠의 원천은 DB 하나뿐**이다. 프론트에는 더미/사본 데이터를 두지 않는다(`src/data/` 없음).
  로딩·실패·빈 상태는 `components/DataState.jsx`가 화면에 그대로 드러낸다.
- 백엔드는 DB 미설정이어도 기동되며, 콘텐츠 엔드포인트는 이때 `503`과 안내 메시지를 반환한다.
- **RLS**: Supabase 테이블에 RLS가 켜져 있고 정책이 없다. 브라우저는 DB에 직접 접근하지 않고
  항상 Flask를 거치며, Flask는 `postgres` 롤로 접속해 RLS를 우회한다. 그래서 publishable 키를
  프론트에 노출할 필요가 없다.

---

## 3. 기술 선택과 배경

| 레이어 | 선택 | 이유 |
|---|---|---|
| 프론트 빌드 | Vite + React 18 | 빠른 HMR, 설정 최소화 |
| 스타일링 | **CSS Modules + CSS 변수** (Tailwind 미사용) | 디자인 토큰을 `tokens.css` 단일 소스로 관리, 런타임/빌드 의존성 최소화 |
| 폰트 | **@fontsource 로컬 번들** | 런타임 CDN 의존 제거(오프라인·성능·프라이버시). 한글 서브셋 자동 처리 |
| 라우팅 | react-router-dom v6 | 표준 SPA 라우팅 |
| 백엔드 | Flask + **App Factory + Blueprint** | 테스트/확장 용이한 표준 구조 |
| ORM | SQLAlchemy (Flask-SQLAlchemy) | Supabase(Postgres) 표준 접근 |
| 설정 | **.env 전면 적용 (12-factor)** | 접속정보·키를 코드에서 분리, 환경별 주입 |

---

## 4. 저장소 구조

```
ggachi/
├── HANDOFF.md                  # 이 문서
├── README.md                   # 실행 요약
├── .gitignore                  # .env, node_modules, dist, __pycache__ 등 제외
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js          # dev 포트 5173, /api → :5000 프록시
│   ├── package.json
│   └── src/
│       ├── main.jsx            # 진입점 (fonts → tokens → global → App)
│       ├── App.jsx             # 라우터
│       ├── styles/
│       │   ├── tokens.css      # ★ 디자인 토큰 (색/폰트/간격/radius) — 단일 소스
│       │   ├── fonts.js        # @fontsource import
│       │   └── global.css      # 리셋 + 기본 스타일
│       ├── api/client.js       # fetch 헬퍼 (동일 경로 동시 요청 1회로 합침)
│       ├── hooks/useApiData.js # API 조회 + 로딩/에러 상태
│       ├── utils/              # format.js(가격·날짜), markdown.js(소식 본문)
│       ├── components/         # 공통: Header, Footer, Container, PageHead, SectionHeading, DataState
│       └── pages/
│           ├── Home/           # Home + sections(Hero/Signature/Subscription/Notice/Guide)
│           ├── Menu/
│           ├── News/           # NewsList, NewsDetail
│           └── Checkout/
│
└── backend/
    ├── requirements.txt
    ├── .env.example            # 복사해서 .env 로 사용
    ├── config.py               # 환경변수 로드 + DB URI 조립
    ├── wsgi.py                 # 진입점 / CLI 타깃
    └── app/
        ├── __init__.py         # App Factory + `init-db` CLI
        ├── extensions.py       # db = SQLAlchemy()
        ├── models.py           # News, Subscription
        ├── seed.py             # 초기 시드 데이터
        └── api/
            ├── __init__.py
            └── routes.py       # 모든 엔드포인트 (Blueprint)
```

---

## 5. 로컬 개발 셋업

### 요구사항
- Node.js 20+
- Python 3.11 ~ 3.12 권장 (일부 패키지는 최신 Python에서 사전 빌드 휠이 없을 수 있음)

### 프론트엔드
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (포트 사용 중이면 5174)
npm run build      # 프로덕션 빌드 → dist/
npm run preview    # 빌드 결과 미리보기
```

### 백엔드
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # 값은 6절 참고
python wsgi.py                     # http://localhost:5000
```

동작 확인:
```bash
curl http://localhost:5000/api/health   # {"status":"ok","databaseConfigured":false}
curl http://localhost:5000/api/plans
```

### DB 초기화 (Supabase 연결 후)
`.env`에 접속 정보를 채운 다음:
```bash
flask --app wsgi init-db           # 테이블 생성 + 소식 시드 3건
curl http://localhost:5000/api/news
```

> ⚠️ 백엔드 명령은 **`backend/` 디렉터리 안에서** 실행해야 한다 (`config` 모듈 경로 기준).

---

## 6. 환경변수 (`backend/.env`)

접속 정보와 키는 **코드에 하드코딩하지 않고 전부 `.env`에서 읽는다.** 실제 `.env`는 `.gitignore`에 포함되어 커밋되지 않는다. 템플릿은 `backend/.env.example`.

| 키 | 필수 | 설명 |
|---|---|---|
| `SECRET_KEY` | 권장 | Flask 세션/보안용 임의 문자열 |
| `PORT` | - | 백엔드 포트 (기본 5000) |
| `DATABASE_URL` | 택1 | 전체 연결 문자열. Supabase URI를 `postgresql+psycopg2://` 접두어로 사용 |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | 택1 | `DATABASE_URL` 미지정 시 항목별로 조합 (host·password 있으면 활성) |
| `CORS_ORIGINS` | - | 허용 오리진(콤마 구분). 기본 `http://localhost:5173` |

DB URI 결정 로직(`config.py`): `DATABASE_URL`이 있으면 그대로, 없고 `DB_HOST`+`DB_PASSWORD`가 있으면 조합, 둘 다 없으면 **미설정**으로 간주하고 앱은 그대로 기동.

---

## 7. API 레퍼런스

Base URL: `http://localhost:5000`

| 메서드 | 경로 | DB | 쓰는 화면 | 설명 |
|---|---|:--:|---|---|
| GET | `/api/health` | ✗ | — | 상태 + `databaseConfigured` |
| GET | `/api/store-info` | ✓ | Header · Footer · Hero 정보바 | 매장 기본 정보 |
| GET | `/api/menu` | ✓ | Menu | 카테고리별 항목 (sort_order 순) |
| GET | `/api/signatures` | ✓ | Home/Signature | 큐레이션 + `menu_items` 조인 가격 |
| GET | `/api/plans` | ✓ | Home/Subscription · Checkout | `is_active` 플랜만 |
| GET | `/api/news` | ✓ | Home/Notice · NewsList | 목록(최신순) + `summary` |
| GET | `/api/news/<id>` | ✓ | NewsDetail | 상세 + `body`(Markdown), **views +1** |
| GET | `/api/guide` | ✓ | Home/Guide | 이용안내 01~06 |
| POST | `/api/subscriptions` | ✓ | (프론트 미연동) | 정기구독 신청 저장 |

**응답 규약**: 가격은 정수(원), 날짜는 ISO 문자열. 표시 포맷(`5,500원` / `2024.06.08`)은 프론트(`utils/format.js`) 담당.

`POST /api/subscriptions` 요청 예시:
```json
{ "planCode": "10", "name": "홍길동", "phone": "010-0000-0000", "payMethod": "kakao" }
```
- `planCode`는 `subscription_plans.code`. 없는 코드/비활성 플랜이면 `400`.
- `payMethod`는 `kakao | toss | card`, 이름·연락처 필수(미입력 시 `400`).
- **금액은 요청 값을 믿지 않고** 서버가 플랜에서 읽어 `amount` 스냅샷으로 저장한다. `status`는 `pending`,
  `start_date`/`end_date`는 `duration_days`로 계산.

---

## 8. 데이터 모델

전체 DDL과 설계 근거는 **`SCHEMA.md`**(원천) / **`docs/DB_설명서.md`**(팀 공유용 해설)에 있다.
`backend/app/models.py`는 그 DDL과 1:1로 대응한다.

| 테이블 | 역할 | 화면 |
|---|---|---|
| `store_info` | 매장 기본 정보 (단일 행, `CHECK (id = 1)`) | Header · Footer · Hero 정보바 |
| `menu_categories` / `menu_items` | 메뉴 원천 데이터 | Menu |
| `home_signatures` | 홈 큐레이션 (`menu_item_id` FK) | Home/Signature |
| `subscription_plans` | 구독 플랜 | Home/Subscription · Checkout |
| `subscriptions` | 신청 기록 (`amount` 스냅샷 + `status`) | (프론트 미연동) |
| `news` | 소식 (`body`=Markdown) | Home/Notice · NewsList · NewsDetail |
| `guide_items` | 이용안내 01~06 | Home/Guide |
| `analytics_sessions` / `analytics_events` | 행동 로그 | (수집 미구현) |

**연동 시 정한 것들**
- **가격**: 정수(원)만 저장·전송. 포맷은 UI.
- **Signature 가격**: `home_signatures`에 두지 않고 FK로 `menu_items.price`를 조인해서 쓴다(원본 1곳).
- **Signature `no`('01'~'03')**: 저장값이 아니라 `sort_order` 순서에서 파생.
- **소식 요약**: `news.summary` 컬럼에 저장한다. 본문 첫 문단에서 파생하지 않는다
  (디자인의 카드 문구가 본문과 달라 파생으로는 재현되지 않음). 마이그레이션: `docs/sql/001_add_news_summary.sql`.
- **2열 레이아웃**(메뉴·이용안내): API는 `sort_order` 순 평평한 배열만 주고, 앞 절반=좌열/뒤 절반=우열로 프론트가 나눈다.

---

## 9. 프론트엔드 상세

### 라우트
| 경로 | 화면 | 컴포넌트 |
|---|---|---|
| `/` | 홈 | `pages/Home` |
| `/menu` | 메뉴 | `pages/Menu` |
| `/news` | 소식 목록 | `pages/News/NewsList` |
| `/news/:id` | 소식 상세 | `pages/News/NewsDetail` |
| `/subscribe` | 정기구독 신청 | `pages/Checkout` |

### 디자인 토큰 시스템
- 모든 색/폰트/간격/radius는 `src/styles/tokens.css`에 CSS 변수로 정의된 **단일 소스**다. 컴포넌트 CSS는 하드코딩 값 대신 `var(--token)`을 쓴다.
- 간격은 디자인 실측값을 그대로 토큰화했다(`--space-8 … --space-56`).
- 폰트 3종: `--font-serif`(Noto Serif KR, 로고·제목), `--font-sans`(Noto Sans KR, 본문), `--font-display`(Quattrocento, 영문 디스플레이).

### 공통 컴포넌트
- `Header` — `variant="transparent"`(홈 히어로 위) / `"solid"`(내부 페이지, 현재 페이지 강조)
- `Footer`, `Container`(콘텐츠 폭 래퍼), `PageHead`(내부 페이지 상단), `SectionHeading`(섹션 헤더)

### 레이아웃 정책
- 디자인이 1440px 데스크톱 단일 안이라, `body { min-width: 1440px }`로 고정하고 창이 작아지면 **가로 스크롤**로 처리한다(레이아웃 붕괴 방지). 모바일 반응형은 별도 디자인 확보 후 진행.

---

## 10. 코드 컨벤션

- 컴포넌트는 `PascalCase.jsx` + 동일명 `*.module.css` 페어.
- CSS Module 클래스는 `camelCase`. 색/치수는 **토큰 변수만** 사용(브랜드 로고 색 등 일회성 예외는 인라인 + 주석).
- 콘텐츠는 **DB가 유일한 원천**. 프론트에 더미/사본 데이터를 두지 않는다. 화면 문구 중 DB에 있는 값
  (상호·주소·영업시간·가격·메뉴명 등)은 하드코딩 금지하고 API로 받는다.
  (섹션 제목/설명 같은 순수 디자인 카피는 컴포넌트에 두어도 된다.)
- 백엔드는 App Factory 패턴. 라우트는 `app/api/routes.py` 블루프린트. 모델 import는 DB 미설정 시 앱 기동을 막지 않도록 **함수 내부에서 지연 import**.

---

## 11. 알려진 이슈 & TODO

빌드/문법 점검은 통과했고 블로킹 버그는 없다. 아래는 연동/완성 단계에서 처리할 항목.

| 우선순위 | 항목 | 내용 |
|---|---|---|
| High | 폼 검증 + 신청 저장 | Checkout은 아직 데모 alert. `POST /api/subscriptions`는 서버 검증까지 준비돼 있으나 **프론트가 호출하지 않음** |
| High | 행동 분석 수집 | `analytics_sessions`/`analytics_events` 테이블·모델만 있고 **수집 미구현**. `POST /api/events` + 프론트 `page_view` 전송 필요 (설계는 SCHEMA.md 3장) |
| Medium | 페이지네이션 | 소식 목록이 항상 1페이지 고정. 건수 늘면 `limit`/`offset` 필요 |
| Medium | 콘텐츠 미확정 | 소식 2·3번 본문이 `(상세 내용 준비 중입니다.)` placeholder |
| Medium | 이미지/아이콘 | `image_url` 연결은 끝났지만 실제 에셋 미등록이라 전부 placeholder 색상 |
| Medium | 품절 표시 | `menu_items.is_sold_out`을 API는 주지만 디자인이 없어 화면에 미표시 |
| Low | Markdown 파서 | `utils/markdown.js`는 문단·`- 목록`만 처리. 제목/링크/강조가 필요해지면 react-markdown 검토 |
| Low | 반응형 | 1440 고정 + 가로 스크롤. 모바일 레이아웃 미포함(디자인 부재) |
| Low | 접근성 | input `label` 연결, 색 대비 등 추후 점검 |
| Low | 스키마 마이그레이션 | `create_all` 기반. 변경 이력관리(Flask-Migrate/Alembic) 미도입 |

---

## 12. 다음 단계 로드맵

1. Supabase 프로젝트 생성 → `backend/.env` 채우기 → `init-db`.
2. 프론트 데이터 소스를 API로 전환(React Query 등 도입 검토).
3. Checkout 폼 검증 + `POST /api/subscriptions` 연동.
4. 실제 이미지/아이콘 교체, 소식 본문 확정.
5. 배포: 프론트 정적 호스팅(Vercel/Netlify), 백엔드 WSGI(gunicorn) + 매니지드 호스팅. `CORS_ORIGINS`·`SECRET_KEY` 운영값 주입.

---

## 부록. 점검 결과 요약

- `npm run build` : 성공
- 백엔드 `py_compile` 전체 : 성공(문법 오류 없음)
- 잔여/불필요 import·참조 : 없음
- `.env` (`backend/.env`, `frontend/.env`, `.env`) : `.gitignore` 처리 확인
- `package.json` : 프로덕션에 불필요한 임시 의존성 없음
