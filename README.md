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

현재 프론트는 화면 확인이 목적이라 **정적 데이터**(`src/data/news.js`, `src/data/plans.js`)로 동작합니다.
나중에 백엔드 API(`/api/...`)로 바꿔 연결할 수 있으며, Vite dev 서버가 `/api` 요청을 `localhost:5000`으로 프록시하도록 이미 설정돼 있습니다.

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
curl http://localhost:5000/api/health   # {"status":"ok","databaseConfigured": false/true}
curl http://localhost:5000/api/plans    # 정기구독 플랜 (DB 불필요)
```

### 2-4. DB 초기화 (Supabase 연결 후)
`.env`에 Supabase 접속 정보를 채운 뒤:
```bash
flask --app wsgi init-db         # 테이블 생성 + 소식 시드 3건 삽입
curl http://localhost:5000/api/news
```

### API 엔드포인트
| 메서드 | 경로 | DB 필요 | 설명 |
|---|---|---|---|
| GET | `/api/health` | ✗ | 서버 상태 + DB 설정 여부 |
| GET | `/api/plans` | ✗ | 정기구독 플랜 목록 |
| GET | `/api/news` | ✓ | 소식 목록 |
| GET | `/api/news/<id>` | ✓ | 소식 상세 |
| POST | `/api/subscriptions` | ✓ | 정기구독 신청 저장 (데모) |

---

## 3. 지금/나중에 준비할 것

| 시점 | 할 일 |
|---|---|
| **지금** | 프론트는 바로 실행 가능. 백엔드도 `.env` 없이 `/api/health`, `/api/plans`까지 확인 가능. |
| **Supabase 준비되면** | ① [supabase.com](https://supabase.com)에서 프로젝트 생성 → ② Project Settings > Database에서 **연결 정보**(host / user / password / db name / port) 또는 **Connection string** 확보 → ③ `backend/.env`에 입력 → ④ `pip install -r requirements.txt`로 `psycopg2-binary` 설치 확인 → ⑤ `flask --app wsgi init-db` 실행 |
| **API 연동 시** | 프론트의 정적 데이터(`data/*.js`)를 `fetch('/api/...')` 호출로 교체 |

> PostgreSQL을 로컬에 따로 설치할 필요는 없습니다. **Supabase가 클라우드 PostgreSQL을 제공**하므로, Supabase 프로젝트만 만들면 됩니다.
> (로컬 PostgreSQL로 개발하고 싶다면, 그때 `.env`의 DB 값을 로컬 접속 정보로 바꾸면 됩니다.)
