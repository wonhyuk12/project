# ===================================================================
# routers/expenses.py  —  "비용(지출) API"  [Phase 3]
# -------------------------------------------------------------------
#   GET    /api/expenses?start=&end=  : 기간 안의 비용 목록
#   POST   /api/expenses              : 비용 추가 (+ audit 'create')
#   DELETE /api/expenses/{id}         : 비용 삭제 (실삭제 + audit 'delete')
#
# ★ 모든 API 는 검문소(Depends(CurrentShop))를 거쳐 내 가게 것만 다룹니다.
#
# ※ 삭제 방식 메모 (사전 확정)
#   - expenses 테이블에는 소프트 삭제용 칸(deleted_at/attributes)이 없고
#     마이그레이션도 하지 않기로 했습니다.
#   - 그래서 비용 삭제는 '실제 삭제'로 하되, 지우기 직전의 전체값을
#     audit_logs(action='delete', before_data)에 남깁니다.
#     → 행은 사라져도 '삭제한 흔적과 내용'은 감사로그에 영구 보존됩니다.
# ===================================================================

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.db import supabase
from backend.security import CurrentShop, ShopContext
from backend.schemas import ExpenseCreate
from backend.audit import write_audit_log
from backend import reporting   # 목록 조회에 기간 필터 도우미 재사용

logger = logging.getLogger("expenses")

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


# -------------------------------------------------------------------
# 1) GET /api/expenses
#    - 기간(spent_at 기준) 안의 비용 목록을 최신순으로 돌려줍니다.
#    - start/end 를 안 주면 전체를 돌려줍니다.
# -------------------------------------------------------------------
@router.get("")
async def list_expenses(
    shop: ShopContext = Depends(CurrentShop),
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
):
    try:
        if start and end:
            # reporting 의 기간 조회를 그대로 재사용 (spent_at 사이 + 최신순)
            records = reporting.fetch_expenses(shop.shop_id, start, end)
        else:
            res = (
                supabase.table("expenses")
                .select("id, name, amount, memo, spent_at, created_at")
                .eq("shop_id", shop.shop_id)
                .order("spent_at", desc=True)
                .limit(reporting.MAX_ROWS)
                .execute()
            )
            records = res.data or []
    except Exception as e:
        logger.error("비용 목록 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail="비용 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.")

    return {"records": records}


# -------------------------------------------------------------------
# 2) POST /api/expenses
#    - 비용 한 건을 추가합니다. shop_id 는 토큰 값으로 강제.
#    - spent_at 을 안 보내면 넣지 않아, DB 기본값(오늘 날짜)이 들어갑니다.
#    - 저장 후 audit_logs 에 action='create' 기록.
# -------------------------------------------------------------------
@router.post("")
async def add_expense(
    body: ExpenseCreate,
    shop: ShopContext = Depends(CurrentShop),
):
    row = {
        "shop_id": shop.shop_id,
        "name": body.name,
        "amount": body.amount,
        "memo": body.memo,
    }
    if body.spent_at:                 # 지출일을 보냈으면 사용, 아니면 DB 기본값(오늘)
        row["spent_at"] = body.spent_at

    try:
        result = supabase.table("expenses").insert(row).execute()
    except Exception as e:
        logger.error("비용 저장 실패: %s", e)
        raise HTTPException(status_code=502, detail="비용 저장에 실패했어요. 잠시 후 다시 시도해 주세요.")

    saved = result.data[0] if result.data else None

    # 추가 이력 남기기 (action='create')
    if saved:
        write_audit_log(
            shop_id=shop.shop_id,
            table_name="expenses",
            record_id=saved["id"],
            action="create",
            user_id=shop.user_id,
            before_data=None,
            after_data=saved,
        )

    return {"ok": True, "record": saved}


# -------------------------------------------------------------------
# 3) DELETE /api/expenses/{expense_id}
#    - 비용을 실제로 삭제합니다. 단, 지우기 직전 전체값을 audit_logs 에 남깁니다.
#    - 내 가게 것만 지울 수 있게 검증합니다.
# -------------------------------------------------------------------
@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: str,
    shop: ShopContext = Depends(CurrentShop),
):
    # (1) 지우기 전 값을 확보 + 소유권 검증 (내 가게 것인지)
    try:
        found = (
            supabase.table("expenses")
            .select("*")
            .eq("id", expense_id)
            .eq("shop_id", shop.shop_id)   # ★ 남의 가게 비용 삭제 차단
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.error("비용 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail="비용 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.")

    if not found.data:
        raise HTTPException(status_code=404, detail="비용을 찾을 수 없어요.")

    before = found.data[0]

    # (2) 실제 삭제
    try:
        supabase.table("expenses").delete().eq("id", expense_id).eq("shop_id", shop.shop_id).execute()
    except Exception as e:
        logger.error("비용 삭제 실패: %s", e)
        raise HTTPException(status_code=502, detail="비용 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.")

    # (3) 삭제 이력 남기기 (before 에 지운 값 통째로 보존)
    write_audit_log(
        shop_id=shop.shop_id,
        table_name="expenses",
        record_id=expense_id,
        action="delete",
        user_id=shop.user_id,
        before_data=before,
        after_data=None,
    )

    return {"ok": True}
