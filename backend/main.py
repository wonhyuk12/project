# ===================================================================
# main.py  —  "서버의 시작점" (지금까지 만든 부품들을 하나로 연결)
# -------------------------------------------------------------------
# 이 파일이 하는 일:
#   1) FastAPI 앱(웹 서버)을 만든다
#   2) 입고 API(intake 라우터)를 연결한다
#   3) frontend 폴더(웹 화면)를 같이 서빙한다
#      → 사장님은 폰에서 주소 하나(http://내PC IP:8000)만 치면 됨
#
# 실행 방법 (가상환경을 켠 상태에서, Gold_plaza 폴더 안에서):
#   uvicorn backend.main:app --host 0.0.0.0 --port 8000
# ===================================================================

from pathlib import Path  # 폴더 경로를 안전하게 다루는 도구

from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles  # 정적 파일(html/js/css) 서빙용

from backend.config import settings   # .env 값이 담긴 설정 상자
from backend.db import supabase       # service key 로 붙은 Supabase 리모컨
from backend.security import CurrentShop, ShopContext  # 검문소
from backend.field_config import public_config        # 업종별 공개 설정 [Phase 5-A]
from backend.categories import fetch_shop_categories, to_config_categories  # 가게 분류 [분류 사용자 정의]
from backend.families import family_of                # 업종군 판별 [3업종군 플랫폼]
from backend.routers import intake    # 우리가 만든 입고 API 묶음
from backend.routers import outgo     # 출고(판매) API 묶음 [Phase 2]
from backend.routers import report    # 정산(리포트) API 묶음 [Phase 3]
from backend.routers import expenses  # 비용(지출) API 묶음 [Phase 3]
from backend.routers import failures  # AI 인식 실패 기록 API [입고 최종판]
from backend.routers import categories  # 분류(카테고리) 관리 API [분류 사용자 정의]
from backend.routers import members     # 회원 관리 API [회원형 2탄]
from backend.routers import membership  # 회원권 상품·판매 API [회원형 2-2]
from backend.routers import attendance  # 출석 체크 API [회원형 2-3]


# FastAPI 앱(웹 서버 본체)을 만듭니다.
#   title 은 자동 생성되는 문서 화면(/docs)에 표시되는 이름이에요.
app = FastAPI(title="매입장부 - 매입·판매 관리")

# 입고 API 를 앱에 연결합니다. (intake.router 안에 prefix="/api/intake" 포함)
app.include_router(intake.router)

# 출고(판매) API 를 앱에 연결합니다. (outgo.router 안에 prefix="/api/outgo" 포함) [Phase 2]
app.include_router(outgo.router)

# 정산(리포트)·비용 API 를 앱에 연결합니다. [Phase 3]
app.include_router(report.router)
app.include_router(expenses.router)

# AI 인식 실패 기록 API 를 앱에 연결합니다. [입고 최종판]
app.include_router(failures.router)

# 분류(카테고리) 관리 API 를 앱에 연결합니다. [분류 사용자 정의]
app.include_router(categories.router)

# 회원 관리 API 를 앱에 연결합니다. [회원형 2탄]
app.include_router(members.router)

# 회원권 상품·판매 API 를 앱에 연결합니다. [회원형 2-2]
app.include_router(membership.router)

# 출석 체크 API 를 앱에 연결합니다. [회원형 2-3]
app.include_router(attendance.router)


# -------------------------------------------------------------------
# 프론트가 로그인에 필요한 '공개 설정'을 알려주는 API
#   - SUPABASE_URL 과 anon key 는 원래 프론트에 공개돼도 되는 값입니다.
#   - 그래도 app.js 에 직접 적어두지 않고, .env 한 곳에서만 관리하려고
#     여기서 내려보냅니다. (service key 나 Gemini 키는 절대 내려보내지 않음!)
# -------------------------------------------------------------------
# ※ 함수 이름을 get_public_config 로 둡니다. (예전엔 public_config 였는데,
#    위에서 import 한 field_config.public_config 헬퍼와 '이름이 같아' 그 헬퍼를 가려버려서
#    아래 /api/me 의 public_config(shop.business_type) 호출이 깨졌었습니다. → 분류 필터·뱃지 버그의 원인)
@app.get("/api/public-config")
async def get_public_config():
    return {
        "supabase_url": settings.SUPABASE_URL,
        "supabase_anon_key": settings.SUPABASE_ANON_KEY,
    }


# -------------------------------------------------------------------
# 로그인한 사장님의 '내 가게 이름'을 알려주는 API
#   - 화면 상단에 "○○상회" 같은 가게 이름을 표시하는 데 씁니다.
#   - 검문소를 통과하므로 자기 가게 정보만 볼 수 있습니다.
# -------------------------------------------------------------------
@app.get("/api/me")
async def me(shop: ShopContext = Depends(CurrentShop)):
    # 검문소가 알아낸 shop_id 로 shops 테이블에서 가게 이름을 찾습니다.
    result = (
        supabase.table("shops")
        .select("name")
        .eq("id", shop.shop_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="가게 정보를 찾을 수 없어요.")

    # 업종(business_type)과 공개 설정(분류/필드/색 등)을 함께 내려줍니다.
    #   → 프론트는 이 설정으로 분류 버튼·드롭다운·입력 필드·뱃지색·카드표시를 그립니다.
    #   ★ [분류 사용자 정의] 분류(categories)는 그 가게가 만든 shop_categories 에서만 옵니다.
    #     (업종 프리셋이 아님. 새 가게는 분류 0개 → 빈 리스트)
    categories = to_config_categories(fetch_shop_categories(shop.shop_id))
    return {
        "shop_id": shop.shop_id,
        "shop_name": result.data[0]["name"],
        "business_type": shop.business_type or "gold",
        # ★ [3업종군 플랫폼] 업종군(retail/membership/manufacturing). 미정이면 null →
        #   프론트가 '시작 선택 화면'을 띄웁니다. (retail 은 기존 앱으로 바로 들어감)
        "business_family": family_of(shop.business_type),
        "config": public_config(shop.business_type, categories),
    }


# -------------------------------------------------------------------
# 프론트(웹 화면) 서빙 설정
#   - 이 파일(main.py)의 위치를 기준으로 frontend 폴더의 실제 경로를 계산합니다.
#     backend/main.py  →  (한 칸 위) Gold_plaza  →  frontend
#   - html=True 로 두면 주소 "/" 로 접속했을 때 index.html 을 자동으로 보여줍니다.
#   - 이 줄은 '맨 마지막'에 둡니다. (먼저 /api/... 를 처리하고, 나머지는 화면 파일로)
# -------------------------------------------------------------------
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app.mount(
    "/",                                   # 웹사이트 최상위 주소
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend",
)
