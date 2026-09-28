# 매입장부 (매입·판매 관리)

매입→재고→판매 구조를 가진 가게(금은방, 중고명품, 시계, 중고폰, 전당포 등)의 매입·판매·정산을 폰에서 관리하는 앱입니다. 업종 특성은 설정(BUSINESS_CONFIGS) 한 곳에서 갈아끼웁니다. 하나의 서버를 여러 가게가 함께 쓰는 멀티테넌트 구조이고, 모든 데이터는 가게(shop_id)별로 분리됩니다. 파이썬(FastAPI) 백엔드가 프론트(순수 html/js/css + PWA)를 같은 주소에서 함께 서빙합니다.

자세한 구현 현황과 다음 작업은 HANDOFF.md 를 참고하세요. 이 문서는 실행과 배포에 집중합니다.

## 1. 로컬(내 PC)에서 실행

가상환경 goldbusiness(윈도우, Python 3.13)가 준비돼 있다는 전제입니다.

1. 이 폴더에 .env 파일을 만듭니다. .env.example 을 복사해 실제 키 4개를 채웁니다.
2. Gold_plaza 폴더 안에서 서버를 켭니다.

   goldbusiness\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

3. 브라우저에서 http://localhost:8000 (또는 폰에서 http://내PC_IP:8000)로 접속합니다.

## 2. 환경변수 (비밀 키 4개)

앱이 돌아가려면 아래 4개가 필요합니다. 로컬에서는 .env 파일에, 배포(Render)에서는 대시보드 Environment 에 넣습니다. 값은 절대 git 에 올리지 않습니다.

- SUPABASE_URL — Supabase 프로젝트 주소
- SUPABASE_ANON_KEY — 프론트(로그인)용 공개 키 (노출돼도 되는 값)
- SUPABASE_SERVICE_KEY — 백엔드 전용 비밀 키 (절대 노출 금지)
- GEMINI_API_KEY — AI 글자 인식 키 (절대 노출 금지)

키 안전에 대해: config.py 는 키가 없을 때 '키 이름'만 안내하고 값은 절대 출력하지 않습니다. service key 와 Gemini 키는 프론트로 내려보내지 않습니다(/api/public-config 는 공개 가능한 URL 과 anon key 만 반환). .env 는 .gitignore 로 제외되어 깃허브에 올라가지 않습니다.

## 3. 배포 절차 (Render 무료, 초보 단계별)

Render 무료 티어로 배포합니다. 카드 없이 0원이며, GitHub 저장소만 연결하면 됩니다. 준비물은 GitHub 계정과 Render 계정(github 로그인 가능)입니다.

### 3-1. 코드를 GitHub 에 올리기

이 폴더는 아직 git 저장소가 아닙니다. Gold_plaza 폴더에서 순서대로 실행합니다.

    git init
    git add .
    git status

git status 목록에 .env 와 goldbusiness 폴더가 보이지 않아야 합니다(.gitignore 로 제외됨). 혹시 .env 가 보이면 멈추고 확인하세요. 확인됐으면:

    git commit -m "first commit"

그다음 GitHub 에서 새 저장소(New repository)를 만듭니다(Private 권장). 만든 뒤 안내에 나온 주소로 연결하고 올립니다.

    git remote add origin https://github.com/내계정/gold-plaza.git
    git branch -M main
    git push -u origin main

### 3-2. Render 에서 서비스 만들기

방법 A (권장, Blueprint): Render 로그인 → New + → Blueprint → 방금 만든 저장소 선택. Render 가 이 폴더의 render.yaml 을 읽어 웹 서비스를 자동으로 구성합니다.

방법 B (수동): New + → Web Service → 저장소 선택 후 아래처럼 직접 설정합니다.

- Runtime: Python
- Build Command: pip install -r requirements.txt
- Start Command: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
- Plan: Free

### 3-3. 환경변수(비밀 키) 넣기

서비스의 Environment 탭에서 위 4개(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, GEMINI_API_KEY)를 이름과 값으로 추가합니다. 값은 로컬 .env 에 있는 실제 키를 복사해 붙입니다. render.yaml 에는 이 4개가 값 없이(sync:false) 등록되므로, 값은 여기서만 넣습니다. Save Changes 를 누르면 자동으로 다시 배포됩니다.

### 3-4. 배포 확인

배포가 끝나면 상단에 주소가 나옵니다(예: https://gold-plaza.onrender.com). 그 주소로 접속해 로그인 화면이 뜨면 성공입니다. Render 가 자동으로 https 를 제공하므로 카메라 촬영과 PWA(홈 화면 추가)도 동작합니다.

## 4. 코드 수정 → 반영 (평소 작업 흐름)

코드를 고친 뒤 Gold_plaza 폴더에서 아래를 실행하면, Render 가 push 를 감지해 자동으로 다시 빌드·배포합니다(보통 1~3분).

    git add .
    git commit -m "무엇을 고쳤는지 한 줄로"
    git push

진행 상황은 Render 서비스 페이지의 Logs / Events 에서 볼 수 있고, 상태가 Live 가 되면 반영이 끝난 것입니다.

## 5. 배포 후 스모크 테스트 체크리스트

배포된 주소로 폰이나 PC 브라우저에서 접속해 아래를 차례로 확인합니다.

1. 로그인: 발급받은 이메일·비밀번호로 로그인되는지.
2. 입고: [입고 사진 찍기]로 사진을 찍어 AI 인식 → 확인 팝업 → 저장 → 입고 목록에 나타나는지.
3. 판매: 재고 카드나 상세에서 [판매] → 판매가 입력(예상 마진 표시 확인) → 저장 → [판매됨] 탭에 마진과 함께 뜨는지.
4. 정산: 하단 [정산] 탭에서 기간을 고르면 매출·마진·비용·순이익 숫자와 그래프가 나오는지. [엑셀 내보내기]로 xlsx 파일이 받아지는지(openpyxl 은 requirements 에 있어 Render 에서는 자동 설치됨).
5. PWA 설치: 폰 브라우저 메뉴의 "홈 화면에 추가"로 아이콘이 만들어지는지. (지금은 홈 화면 아이콘까지 지원하며, 오프라인 완전 동작은 아직 아닙니다.)

첫 접속이 30~60초 느리면 잠들었던 서버가 깨어나는 중입니다(아래 참고).

## 6. 사장님께 드리는 안내 (무료 티어의 잠들기)

Render 무료 티어는 15분 동안 아무도 안 쓰면 서버가 절약모드로 잠들고, 다음 접속 때 다시 깨어나느라 첫 화면이 30~60초 느릴 수 있습니다. 사장님께는 이렇게 안내하시면 됩니다.

"가게 문 열고 앱을 처음 켜면 잠깐(30초쯤) 로딩이 걸릴 수 있어요. 서버가 절약모드에서 깨어나는 시간이에요. 한 번 켜지면 그다음부터는 바로바로 됩니다."

잠들기를 아예 없애려면 유료로 올리면 됩니다(Render 유료 약 월 $7, 또는 Railway 약 월 $5). 무료를 유지하면서 낮 시간대 잠들기를 줄이고 싶으면, UptimeRobot 같은 무료 모니터링으로 5~10분마다 서비스 주소를 호출해 깨워둘 수 있습니다. 다만 무료는 월 750시간 한도가 있어(한 서비스만 24시간 켜두면 한 달 약 744시간으로 거의 한 달 커버) 여러 서비스를 함께 돌리면 한도를 넘길 수 있으니 참고하세요.

## 7. CORS / HTTPS 메모

- CORS: 프론트를 백엔드가 같은 주소에서 함께 서빙하는 단일 서버라, 프론트와 API 가 같은 출처(origin)입니다. 그래서 별도 CORS 설정이 필요 없습니다.
- HTTPS: Render 가 *.onrender.com 주소에 자동으로 https 를 붙여 줍니다. PWA 와 카메라 접근은 https 가 필수인데, 이 조건이 자동으로 충족됩니다. 인증서를 따로 설정할 필요가 없습니다.
