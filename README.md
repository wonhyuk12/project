# 까치커피바 (GGACHI COFFEE BAR)

Figma 디자인 기반 풀스택 프로젝트.

- **프론트엔드**: React + Vite (CSS Modules, 로컬 폰트 번들)
- **백엔드**: Flask + SQLAlchemy
- **데이터베이스**: Supabase (PostgreSQL) — *접속 정보는 나중에 `.env`로 주입*

```
ggachi/
├── frontend/     # React + Vite 앱 (5개 화면)
└── backend/      # Flask API 뼈대
```

> DB가 아직 연결되지 않아도 **프론트엔드는 단독으로 실행**됩니다.
> 백엔드도 DB 없이 기동되며, DB가 필요한 API만 안내 메시지를 반환합니다.

---

## 1. 프론트엔드 실행

```bash
cd frontend
npm install          # 최초 1회
npm run dev          # http://localhost:5173 (포트 사용 중이면 5174)
```

빌드:
```bash
npm run build        # dist/ 생성
npm run preview      # 빌드 결과 미리보기
```

화면: `/` 홈 · `/menu` 메뉴 · `/news` 소식 목록 · `/news/:id` 소식 상세 · `/subscribe` 정기구독 신청

프론트의 **모든 콘텐츠는 DB(API)에서** 옵니다. 프론트에 사본/더미 데이터는 두지 않습니다.
Vite dev 서버가 `/api` 요청을 `localhost:5000`(Flask)으로 프록시합니다.

> ⚠️ 따라서 **백엔드가 떠 있고 DB에 시드가 들어가 있어야** 화면에 내용이 보입니다.
> 백엔드가 없으면 각 영역에 "콘텐츠를 불러오지 못했습니다" 안내가 표시됩니다.

---

## 2. 백엔드 실행

### 2-1. 가상환경 + 패키지 설치
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```
> Python 3.11 ~ 3.12 권장. (psycopg2-binary 등 일부 패키지는 아주 최신 버전의 Python에서 미리 빌드된 파일이 없을 수 있습니다.)

### 2-2. 환경변수(.env) 준비
```bash
cp .env.example .env
# .env 를 열어 값을 채웁니다. (아래 "3. 준비물" 참고)
```
- **DB 접속 정보와 API 키는 코드에 하드코딩하지 않고 전부 `.env`에서 읽습니다.**
- 실제 `.env`는 `.gitignore`에 포함되어 git에 올라가지 않습니다.

### 2-3. 실행
```bash
# DB 없이도 그냥 뜹니다.
python wsgi.py                   # http://localhost:5000
```

동작 확인:
```bash
curl http://localhost:5000/api/health   # {"status":"ok","databaseConfigured": true}
```

### 2-4. DB 초기화 (콘텐츠 시드 삽입) — **처음 1회 필수**
`.env`에 Supabase 접속 정보가 채워진 상태에서:
```bash
flask --app wsgi init-db         # 없는 테이블 생성 + 콘텐츠 시드 삽입
curl http://localhost:5000/api/menu
```
- 스키마의 원천은 `SCHEMA.md`의 DDL입니다. Supabase에 DDL을 이미 실행했다면 `init-db`는 **시드만** 채웁니다.
- 이미 데이터가 있는 테이블은 건너뜁니다(중복 삽입 없음). 여러 번 실행해도 안전합니다.

### API 엔드포인트
| 메서드 | 경로 | DB 필요 | 화면 | 설명 |
|---|---|---|---|---|
| GET | `/api/health` | ✗ | — | 서버 상태 + DB 설정 여부 |
| GET | `/api/store-info` | ✓ | 헤더·푸터·정보바 | 매장 기본 정보 |
| GET | `/api/menu` | ✓ | 메뉴 | 카테고리 + 항목 |
| GET | `/api/signatures` | ✓ | 홈 시그니처 | 큐레이션 (가격은 메뉴에서 조인) |
| GET | `/api/plans` | ✓ | 홈 구독·신청 | 판매 중인 플랜 |
| GET | `/api/news` | ✓ | 홈 소식·소식 목록 | 소식 목록(최신순) |
| GET | `/api/news/<id>` | ✓ | 소식 상세 | 소식 상세 (**조회 시 views +1**) |
| GET | `/api/guide` | ✓ | 홈 이용안내 | 이용안내 01~06 |
| POST | `/api/subscriptions` | ✓ | — | 정기구독 신청 저장 (프론트 미연동) |

가격은 **정수(원)** 로 응답하고 "5,500원" 포맷은 프론트가 합니다. 날짜도 ISO로 주고 프론트가 `2024.06.08`로 표시합니다.

---

## 3. 지금/나중에 준비할 것

| 시점 | 할 일 |
|---|---|
| **완료** | Supabase 프로젝트 생성 · 스키마(DDL) 적용 · `backend/.env` 접속정보 입력 · 프론트 전 화면 API 연동 |
| **지금 할 일** | `cd backend` → 가상환경 + `pip install -r requirements.txt` → `flask --app wsgi init-db`(시드 삽입) → `python wsgi.py` → 다른 터미널에서 `cd frontend && npm run dev` |
| **다음** | Checkout 폼 검증 + `POST /api/subscriptions` 연동, 행동 분석 로그(`analytics_*`) 수집, 실제 이미지(`image_url`) 등록 |

> PostgreSQL을 로컬에 따로 설치할 필요는 없습니다. **Supabase가 클라우드 PostgreSQL을 제공**하므로, Supabase 프로젝트만 만들면 됩니다.
> (로컬 PostgreSQL로 개발하고 싶다면, 그때 `.env`의 DB 값을 로컬 접속 정보로 바꾸면 됩니다.)
