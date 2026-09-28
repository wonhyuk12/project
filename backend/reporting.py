# ===================================================================
# reporting.py  —  "정산 집계 공용 도우미"  [Phase 3]
# -------------------------------------------------------------------
# 정산 화면(요약·그래프·엑셀)이 공통으로 쓰는 계산을 한곳에 모읍니다.
#   - 시간대 변환 (UTC로 저장된 created_at 을 한국시간으로)
#   - 판매/비용 데이터를 기간에 맞게 가져오기
#   - 매출·마진·비용·순이익 합계 계산
#
# ★ 집계 규칙 (아주 중요)
#   - 취소된 판매(attributes->>cancelled_at 있음)는 모든 집계에서 제외합니다.
#   - 삭제된 입고(intake_records.deleted_at 있음)에 연결된 판매도 제외합니다.
#   - 핵심 공식:
#       매출   = 판매가(sale_price) 합
#       마진   = (판매가 − 연결된 입고의 매입가) 합
#       비용   = 기간 내 expenses.amount 합
#       순이익 = 마진 − 비용
#
# ※ 시간대: DB의 created_at 은 UTC로 저장됩니다. 한국(Asia/Seoul)은
#   여름시간(DST)이 없어 항상 UTC+9 이므로, 복잡한 tz 라이브러리 없이
#   '+9시간 고정' 으로 안전하게 변환합니다.
# ===================================================================

import logging
from datetime import datetime, timezone, timedelta, date

from backend.db import supabase

logger = logging.getLogger("reporting")

# 한국 시간대 (UTC+9 고정). 한국은 서머타임이 없어 이 방식이 안전합니다.
KST = timezone(timedelta(hours=9))

# 한 번에 가져올 최대 행 수. (한 가게의 한 기간 판매/비용은 보통 이보다 훨씬 적음)
MAX_ROWS = 10000


# -------------------------------------------------------------------
# 시간대 도우미
# -------------------------------------------------------------------
def kst_range_to_utc(start_str: str, end_str: str):
    """
    'YYYY-MM-DD' 형태의 한국 날짜 두 개(시작일~종료일)를 받아,
    그 기간을 덮는 UTC 시각 범위를 돌려줍니다.
      - 시작: 시작일 0시(한국) → UTC
      - 끝  : 종료일 '다음날' 0시(한국) → UTC  (이 값 '미만'으로 걸러 하루를 통째로 포함)
    돌려주는 값: (start_utc_iso, end_utc_iso)  둘 다 ISO 문자열.
    """
    sy, sm, sd = (int(x) for x in start_str.split("-"))
    ey, em, ed = (int(x) for x in end_str.split("-"))
    start_kst = datetime(sy, sm, sd, 0, 0, 0, tzinfo=KST)
    end_kst = datetime(ey, em, ed, 0, 0, 0, tzinfo=KST) + timedelta(days=1)
    return (
        start_kst.astimezone(timezone.utc).isoformat(),
        end_kst.astimezone(timezone.utc).isoformat(),
    )


def to_kst(created_at_iso: str) -> datetime:
    """
    DB의 created_at(UTC ISO 문자열)을 한국시간 datetime 으로 바꿉니다.
    (일별 그래프·히트맵에서 '한국 기준 며칠/무슨 요일/몇 시'인지 판단하는 데 씁니다.)
    """
    s = created_at_iso.replace("Z", "+00:00")   # 끝의 Z 를 +00:00 으로
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:                        # 혹시 tz 정보가 없으면 UTC로 간주
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST)


# -------------------------------------------------------------------
# 데이터 가져오기
# -------------------------------------------------------------------
def fetch_sales(shop_id: str, start_str: str, end_str: str) -> list[dict]:
    """
    기간 안의 '유효한 판매'만 가져와서, 계산하기 좋은 모양으로 정리해 돌려줍니다.
      - 취소 안 된 판매만 (attributes->>cancelled_at is null)
      - 판매 시각(created_at)이 기간(한국 날짜) 안
      - 연결된 입고가 삭제되지 않은 것만 (deleted_at is null)  ← 파이썬에서 거름
    각 항목: {sale_price, purchase_price, margin, category, dt_kst, sold_at}
    """
    start_utc, end_utc = kst_range_to_utc(start_str, end_str)
    try:
        res = (
            supabase.table("outgo_records")
            .select(
                "sale_price, created_at, intake_records(purchase_price, category, deleted_at)"
            )
            .eq("shop_id", shop_id)
            .is_("attributes->>cancelled_at", "null")   # 취소 안 된 것만
            .gte("created_at", start_utc)
            .lt("created_at", end_utc)                   # 종료일 다음날 0시 '미만'
            .limit(MAX_ROWS)
            .execute()
        )
    except Exception as e:
        logger.error("판매 집계 조회 실패: %s", e)
        raise

    sales = []
    for r in res.data or []:
        intake = r.get("intake_records") or {}
        # 삭제된 입고에 연결된 판매는 집계에서 제외
        if intake.get("deleted_at") is not None:
            continue
        sale_price = r.get("sale_price") or 0
        purchase = intake.get("purchase_price") or 0
        sales.append({
            "sale_price": sale_price,
            "purchase_price": purchase,
            "margin": sale_price - purchase,
            "category": intake.get("category") or "other",
            "dt_kst": to_kst(r["created_at"]) if r.get("created_at") else None,
            "sold_at": r.get("created_at"),
        })
    return sales


def fetch_expenses(shop_id: str, start_str: str, end_str: str) -> list[dict]:
    """
    기간(spent_at 기준) 안의 비용 행들을 최신순으로 가져옵니다.
      - spent_at 은 '날짜'라 시간대 변환이 필요 없습니다. (start~end 사이 날짜만)
    """
    try:
        res = (
            supabase.table("expenses")
            .select("id, name, amount, memo, spent_at, created_at")
            .eq("shop_id", shop_id)
            .gte("spent_at", start_str)
            .lte("spent_at", end_str)
            .order("spent_at", desc=True)
            .limit(MAX_ROWS)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error("비용 집계 조회 실패: %s", e)
        raise


# -------------------------------------------------------------------
# 합계 계산
# -------------------------------------------------------------------
def summarize(sales: list[dict], expenses: list[dict]) -> dict:
    """
    판매 목록과 비용 목록으로 4가지 합계를 냅니다.
      매출 = 판매가 합, 마진 = 마진 합, 비용 = amount 합, 순이익 = 마진 − 비용
    """
    revenue = sum(s["sale_price"] for s in sales)
    margin = sum(s["margin"] for s in sales)
    expense = sum((e.get("amount") or 0) for e in expenses)
    net = margin - expense
    return {"revenue": revenue, "margin": margin, "expense": expense, "net": net}


def previous_period(start_str: str, end_str: str):
    """
    '직전 동일 길이 기간'을 돌려줍니다. (전월 같은 기간 대비 증감 계산용)
      예) 이번 달(7/1~7/31) → 직전 (6/1~6/30) 처럼, 시작일 바로 앞의 같은 길이 구간.
    돌려주는 값: (prev_start_str, prev_end_str)
    """
    start_d = date.fromisoformat(start_str)
    end_d = date.fromisoformat(end_str)
    span_days = (end_d - start_d).days          # 기간 길이(일)
    prev_end_d = start_d - timedelta(days=1)     # 이번 기간 시작 바로 전날
    prev_start_d = prev_end_d - timedelta(days=span_days)
    return prev_start_d.isoformat(), prev_end_d.isoformat()


def percent_change(current: int, previous: int):
    """
    증감 퍼센트 = (이번 − 지난) / |지난| × 100. 소수 1자리 반올림.
    지난 값이 0이면 비교 기준이 없으므로 None(표시 안 함)을 돌려줍니다.
    """
    if previous == 0:
        return None
    return round((current - previous) / abs(previous) * 100, 1)
