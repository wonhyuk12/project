# ===================================================================
# routers/report.py  —  "정산(리포트) API"  [Phase 3]
# -------------------------------------------------------------------
#   GET /api/report/summary  : 매출/마진/비용/순이익 + 전(前)기간 대비 증감
#   GET /api/report/daily    : 일별 매출·순이익 (선그래프용)
#   GET /api/report/heatmap  : 요일 × 시간대 판매 건수 (히트맵용)
#   GET /api/report/category : 분류별(금/은/기타) 매출 (도넛용)
#   GET /api/report/excel    : 판매내역+비용 xlsx 파일 다운로드
#
# ★ 모든 API 는 검문소(Depends(CurrentShop))를 거쳐 내 가게 것만 집계합니다.
# ★ 집계 규칙(취소판매·삭제입고 제외)은 reporting.py 에 모아 두었습니다.
# ★ 시간대는 한국(UTC+9) 기준. (reporting.py 의 KST 변환 사용)
# ===================================================================

import io
import logging
from datetime import date
from urllib.parse import quote   # 파일 이름의 한글을 안전하게 인코딩

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from backend.security import CurrentShop, ShopContext
from backend.field_config import get_business_config   # 업종별 분류 설정 [Phase 5-A]
from backend import reporting

logger = logging.getLogger("report")

router = APIRouter(prefix="/api/report", tags=["report"])


# 기간 파라미터(start, end)가 'YYYY-MM-DD' 형식인지 검사합니다. 아니면 400.
def _check_dates(start: str, end: str) -> None:
    try:
        s = date.fromisoformat(start)
        e = date.fromisoformat(end)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="기간 형식이 올바르지 않습니다.")
    if s > e:
        raise HTTPException(status_code=400, detail="시작일이 종료일보다 늦을 수 없습니다.")


# -------------------------------------------------------------------
# 1) GET /api/report/summary
#    - 매출/마진/비용/순이익 4가지 + '직전 동일 기간' 대비 증감(%)
# -------------------------------------------------------------------
@router.get("/summary")
async def summary(
    shop: ShopContext = Depends(CurrentShop),
    start: str = Query(...),
    end: str = Query(...),
):
    _check_dates(start, end)

    # 이번 기간
    sales = reporting.fetch_sales(shop.shop_id, start, end)
    expenses = reporting.fetch_expenses(shop.shop_id, start, end)
    cur = reporting.summarize(sales, expenses)

    # 직전 동일 길이 기간 (전월 같은 기간 대비 증감 계산용)
    prev_start, prev_end = reporting.previous_period(start, end)
    prev_sales = reporting.fetch_sales(shop.shop_id, prev_start, prev_end)
    prev_expenses = reporting.fetch_expenses(shop.shop_id, prev_start, prev_end)
    prev = reporting.summarize(prev_sales, prev_expenses)

    # 각 항목의 증감 퍼센트 (지난 값이 0이면 None → 화면에서 표시 안 함)
    change = {
        key: reporting.percent_change(cur[key], prev[key])
        for key in ("revenue", "margin", "expense", "net")
    }

    return {**cur, "prev": prev, "change": change}


# -------------------------------------------------------------------
# 2) GET /api/report/daily
#    - 기간 안의 '모든 날짜'에 대해 일별 매출·순이익을 돌려줍니다.
#      (판매/비용이 없는 날도 0으로 채워, 선그래프 x축이 끊기지 않게)
# -------------------------------------------------------------------
@router.get("/daily")
async def daily(
    shop: ShopContext = Depends(CurrentShop),
    start: str = Query(...),
    end: str = Query(...),
):
    _check_dates(start, end)

    sales = reporting.fetch_sales(shop.shop_id, start, end)
    expenses = reporting.fetch_expenses(shop.shop_id, start, end)

    # 날짜별로 매출/마진(판매)과 비용을 모읍니다. (키: 'YYYY-MM-DD' 한국 날짜)
    by_day_sale: dict[str, dict] = {}
    for s in sales:
        if not s["dt_kst"]:
            continue
        key = s["dt_kst"].date().isoformat()
        d = by_day_sale.setdefault(key, {"revenue": 0, "margin": 0})
        d["revenue"] += s["sale_price"]
        d["margin"] += s["margin"]

    by_day_expense: dict[str, int] = {}
    for e in expenses:
        key = e.get("spent_at")
        if not key:
            continue
        by_day_expense[key] = by_day_expense.get(key, 0) + (e.get("amount") or 0)

    # 시작일부터 종료일까지 하루씩 돌며 배열을 만듭니다.
    start_d = date.fromisoformat(start)
    end_d = date.fromisoformat(end)
    days = (end_d - start_d).days
    result = []
    for i in range(days + 1):
        d = start_d.fromordinal(start_d.toordinal() + i)
        key = d.isoformat()
        sale = by_day_sale.get(key, {"revenue": 0, "margin": 0})
        exp = by_day_expense.get(key, 0)
        result.append({
            "date": key,
            "revenue": sale["revenue"],
            "net": sale["margin"] - exp,   # 그 날 순이익 = 그 날 마진 − 그 날 비용
        })

    return {"days": result}


# -------------------------------------------------------------------
# 3) GET /api/report/heatmap
#    - 요일(월~일 7개) × 시간대(3시간 단위 8칸) 판매 '건수'.
#    - 색 농도로 표현하려고, 최댓값(max)도 함께 돌려줍니다.
#    - matrix[요일][시간대칸] = 건수.  요일 0=월 … 6=일 / 칸 0=0~3시 … 7=21~24시
# -------------------------------------------------------------------
@router.get("/heatmap")
async def heatmap(
    shop: ShopContext = Depends(CurrentShop),
    start: str = Query(...),
    end: str = Query(...),
):
    _check_dates(start, end)

    sales = reporting.fetch_sales(shop.shop_id, start, end)

    # 7 x 8 을 0으로 채워 두고, 판매마다 해당 칸을 +1 합니다.
    matrix = [[0 for _ in range(8)] for _ in range(7)]
    max_count = 0
    for s in sales:
        dt = s["dt_kst"]
        if not dt:
            continue
        dow = dt.weekday()        # 월=0 … 일=6 (한국시간 기준)
        bucket = dt.hour // 3     # 0~7 (3시간 단위)
        matrix[dow][bucket] += 1
        if matrix[dow][bucket] > max_count:
            max_count = matrix[dow][bucket]

    return {"matrix": matrix, "max": max_count}


# -------------------------------------------------------------------
# 4) GET /api/report/category
#    - 분류별(금/은/기타) 매출(판매가 합). 도넛 그래프용.
# -------------------------------------------------------------------
@router.get("/category")
async def category(
    shop: ShopContext = Depends(CurrentShop),
    start: str = Query(...),
    end: str = Query(...),
):
    _check_dates(start, end)

    sales = reporting.fetch_sales(shop.shop_id, start, end)

    # 이 가게 업종의 분류들로 합계 칸을 만듭니다. [Phase 5-A]
    cfg = get_business_config(shop.business_type)
    cats = cfg["categories"]
    totals = {c["value"]: 0 for c in cats}
    # 설정에 없는 분류값이 섞여 있으면 'other'(있으면)로 몰아 줍니다.
    fallback = "other" if "other" in totals else (cats[0]["value"] if cats else None)
    for s in sales:
        cat = s["category"] if s["category"] in totals else fallback
        if cat is not None:
            totals[cat] += s["sale_price"]

    # 화면에서 쓰기 좋게 라벨·색과 함께 배열로도 줍니다.
    items = [
        {"category": c["value"], "label": c["label"], "color": c["color"], "revenue": totals[c["value"]]}
        for c in cats
    ]
    return {"totals": totals, "items": items}


# -------------------------------------------------------------------
# 5) GET /api/report/excel
#    - 선택 기간의 '판매내역'과 '비용'을 시트 2개로 담은 xlsx 파일을 내려줍니다.
#    - 각 시트에 합계 행을 붙입니다.
#    - openpyxl 이 설치돼 있어야 합니다. 없으면 안내 메시지(501)를 돌려줍니다.
#      설치: goldbusiness\Scripts\python.exe -m pip install openpyxl
# -------------------------------------------------------------------
@router.get("/excel")
async def excel(
    shop: ShopContext = Depends(CurrentShop),
    start: str = Query(...),
    end: str = Query(...),
):
    _check_dates(start, end)

    # openpyxl 은 이 기능에서만 쓰므로, 여기서 '늦게' 불러옵니다.
    #   → 설치가 안 돼 있어도 앱의 다른 기능은 멀쩡히 돌아갑니다.
    try:
        from openpyxl import Workbook
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="엑셀 기능을 쓰려면 서버에 openpyxl 설치가 필요합니다.",
        )

    sales = reporting.fetch_sales(shop.shop_id, start, end)
    expenses = reporting.fetch_expenses(shop.shop_id, start, end)

    wb = Workbook()

    # --- 시트 1: 판매내역 ---
    ws1 = wb.active
    ws1.title = "판매내역"
    ws1.append(["판매일시(한국)", "분류", "매입가", "판매가", "마진"])
    # 이 가게 업종의 분류 라벨표 (예: gold→금, bag→가방) [Phase 5-A]
    cfg = get_business_config(shop.business_type)
    cat_label = {c["value"]: c["label"] for c in cfg["categories"]}
    total_purchase = total_sale = total_margin = 0
    for s in sales:
        dt = s["dt_kst"]
        when = dt.strftime("%Y-%m-%d %H:%M") if dt else ""
        ws1.append([
            when,
            cat_label.get(s["category"], s["category"]),
            s["purchase_price"],
            s["sale_price"],
            s["margin"],
        ])
        total_purchase += s["purchase_price"]
        total_sale += s["sale_price"]
        total_margin += s["margin"]
    ws1.append(["합계", "", total_purchase, total_sale, total_margin])

    # --- 시트 2: 비용 ---
    ws2 = wb.create_sheet("비용")
    ws2.append(["지출일", "이름", "금액", "메모"])
    total_expense = 0
    for e in expenses:
        ws2.append([
            e.get("spent_at", ""),
            e.get("name", ""),
            e.get("amount", 0),
            e.get("memo", "") or "",
        ])
        total_expense += (e.get("amount") or 0)
    ws2.append(["합계", "", total_expense, ""])

    # 워크북을 메모리(바이트)로 저장해 파일로 내려보냅니다.
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f"정산_{start}_{end}.xlsx"
    # 파일 이름에 한글이 있어 UTF-8 퍼센트 인코딩(RFC 5987) 방식으로 지정 (브라우저 호환)
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
    }
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
