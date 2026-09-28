# ===================================================================
# routers/membership.py  —  "회원권 상품 + 회원권 판매 API"  [회원형 2-2]
# -------------------------------------------------------------------
#   [상품]  GET   /api/membership-plans        : 활성 상품 목록(정렬순)
#           POST  /api/membership-plans        : 상품 추가
#           PATCH /api/membership-plans/{id}   : 상품 수정(이름·종류·기간/횟수·가격·숨김·정렬)
#   [판매]  GET    /api/memberships?member_id= : 한 회원의 회원권 목록
#           POST   /api/memberships            : 회원권 판매(회원에게 상품 부여)
#           DELETE /api/memberships/{id}       : 판매 취소(소프트 삭제 + status='cancelled')
#
# ★ 모든 API 는 Depends(CurrentShop) 검문소를 거쳐 '내 가게' 것만 다룹니다.
# ★ 판매 시점의 상품 정보(이름·종류·총횟수)를 memberships 에 '스냅샷'으로 저장합니다.
#   → 나중에 상품을 바꿔도 지난 판매 기록이 안 흔들립니다.
# ===================================================================

import logging
from datetime import datetime, timezone, date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.db import supabase
from backend.security import CurrentShop, ShopContext
from backend.schemas import PlanCreate, PlanUpdate, MembershipCreate
from backend.audit import write_audit_log
from backend.routers.members import _fetch_member   # 회원이 내 가게 사람인지 검증에 재사용


logger = logging.getLogger("membership")

# 한 라우터로 두 자원(상품/판매)을 모두 처리 (경로를 전체로 적음)
router = APIRouter(prefix="/api", tags=["membership"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fetch_plan(plan_id: str, shop_id: str):
    """이 id 이면서 '내 가게' 상품 한 개를 가져옵니다. (없으면 None)"""
    res = (
        supabase.table("membership_plans").select("*")
        .eq("id", plan_id).eq("shop_id", shop_id).limit(1).execute()
    )
    return res.data[0] if res.data else None


# ===================================================================
# [상품] 회원권 상품 (membership_plans)
# ===================================================================

@router.get("/membership-plans")
async def list_plans(shop: ShopContext = Depends(CurrentShop)):
    try:
        res = (
            supabase.table("membership_plans")
            .select("id, name, kind, duration_days, total_count, price, is_active, sort_order")
            .eq("shop_id", shop.shop_id)
            .eq("is_active", True)              # 숨긴 상품은 제외
            .order("sort_order")
            .execute()
        )
    except Exception as e:
        logger.error("상품 목록 조회 실패: %s", e)
        return {"plans": []}
    return {"plans": res.data or []}


@router.post("/membership-plans")
async def create_plan(body: PlanCreate, shop: ShopContext = Depends(CurrentShop)):
    # 정렬 순서는 기존(숨김 포함) 최대 + 1 로 맨 뒤에.
    try:
        ex = supabase.table("membership_plans").select("sort_order").eq("shop_id", shop.shop_id).execute()
        next_order = max([r.get("sort_order", 0) for r in (ex.data or [])], default=-1) + 1
    except Exception:
        next_order = 0

    row = {
        "shop_id": shop.shop_id,
        "name": body.name,
        "kind": body.kind,
        # 종류에 맞는 값만 채웁니다. (기간권=일수 / 횟수권=총횟수)
        "duration_days": body.duration_days if body.kind == "period" else None,
        "total_count": body.total_count if body.kind == "count" else None,
        "price": body.price or 0,
        "is_active": True,
        "sort_order": next_order,
    }
    try:
        res = supabase.table("membership_plans").insert(row).execute()
    except Exception as e:
        logger.error("상품 추가 실패: %s", e)
        raise HTTPException(status_code=502, detail="상품을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.")

    saved = res.data[0] if res.data else None
    if saved:
        write_audit_log(shop_id=shop.shop_id, table_name="membership_plans", record_id=saved["id"],
                        action="create", user_id=shop.user_id, before_data=None, after_data=saved)
    return {"ok": True, "plan": saved}


@router.patch("/membership-plans/{plan_id}")
async def update_plan(plan_id: str, body: PlanUpdate, shop: ShopContext = Depends(CurrentShop)):
    before = _fetch_plan(plan_id, shop.shop_id)
    if before is None:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없어요.")

    updates: dict = {}
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="상품 이름을 입력해 주세요.")
        updates["name"] = name
    if body.kind is not None:
        if body.kind not in ("period", "count"):
            raise HTTPException(status_code=422, detail="상품 종류가 올바르지 않습니다.")
        updates["kind"] = body.kind
    for key in ("duration_days", "total_count", "price", "is_active", "sort_order"):
        val = getattr(body, key)
        if val is not None:
            updates[key] = val
    if not updates:
        raise HTTPException(status_code=422, detail="바꿀 내용이 없어요.")
    updates["updated_at"] = _now_iso()

    try:
        res = (supabase.table("membership_plans").update(updates)
               .eq("id", plan_id).eq("shop_id", shop.shop_id).execute())
    except Exception as e:
        logger.error("상품 수정 실패: %s", e)
        raise HTTPException(status_code=502, detail="상품을 수정하지 못했어요. 잠시 후 다시 시도해 주세요.")

    after = res.data[0] if res.data else None
    if after:
        write_audit_log(shop_id=shop.shop_id, table_name="membership_plans", record_id=plan_id,
                        action="update", user_id=shop.user_id, before_data=before, after_data=after)
    return {"ok": True, "plan": after}


# ===================================================================
# [판매] 회원권 판매 (memberships)
# ===================================================================

@router.get("/memberships")
async def list_memberships(
    member_id: str = Query(...),                   # 어느 회원의 회원권인지 (필수)
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    try:
        res = (
            supabase.table("memberships").select("*")
            .eq("shop_id", shop.shop_id)
            .eq("member_id", member_id)
            .is_("deleted_at", "null")             # 취소(삭제) 안 된 것만
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as e:
        logger.error("회원권 목록 조회 실패: %s", e)
        return {"memberships": []}
    return {"memberships": res.data or []}


@router.post("/memberships")
async def sell_membership(body: MembershipCreate, shop: ShopContext = Depends(CurrentShop)):
    # (1) 회원·상품이 '내 가게' 것인지 확인.
    member = _fetch_member(body.member_id, shop.shop_id, only_alive=True)
    if member is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없어요.")
    plan = _fetch_plan(body.plan_id, shop.shop_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="회원권 상품을 찾을 수 없어요.")

    # (2) 시작일(없으면 오늘) + 종류별로 만료일/잔여횟수 계산.
    start = (body.start_date or "").strip() or date.today().isoformat()
    kind = plan.get("kind")
    end_date = None
    remaining = None
    if kind == "period":
        dd = plan.get("duration_days")
        if dd:
            try:
                end_date = (date.fromisoformat(start) + timedelta(days=int(dd))).isoformat()
            except Exception:
                end_date = None
    elif kind == "count":
        remaining = plan.get("total_count")

    price_paid = body.price_paid if body.price_paid is not None else (plan.get("price") or 0)

    # (3) 판매 저장 — 상품 정보를 스냅샷으로 함께 넣습니다.
    row = {
        "shop_id": shop.shop_id,
        "member_id": body.member_id,
        "plan_id": body.plan_id,
        "plan_name": plan.get("name"),         # 스냅샷
        "kind": kind,                           # 스냅샷
        "start_date": start,
        "end_date": end_date,
        "total_count": plan.get("total_count"), # 스냅샷
        "remaining_count": remaining,
        "price_paid": price_paid,
        "status": "active",
        "memo": (body.memo or "").strip() or None,
    }
    try:
        res = supabase.table("memberships").insert(row).execute()
    except Exception as e:
        logger.error("회원권 판매 실패: %s", e)
        raise HTTPException(status_code=502, detail="회원권 판매에 실패했어요. 잠시 후 다시 시도해 주세요.")

    saved = res.data[0] if res.data else None
    if saved:
        write_audit_log(shop_id=shop.shop_id, table_name="memberships", record_id=saved["id"],
                        action="create", user_id=shop.user_id, before_data=None, after_data=saved)
    return {"ok": True, "membership": saved}


@router.delete("/memberships/{membership_id}")
async def cancel_membership(membership_id: str, shop: ShopContext = Depends(CurrentShop)):
    # 취소: 실제로 지우지 않고 deleted_at + status='cancelled' 로 표시(소프트 취소).
    try:
        found = (supabase.table("memberships").select("*")
                 .eq("id", membership_id).eq("shop_id", shop.shop_id)
                 .is_("deleted_at", "null").limit(1).execute())
    except Exception as e:
        logger.error("회원권 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail="회원권 취소에 실패했어요. 잠시 후 다시 시도해 주세요.")
    if not found.data:
        raise HTTPException(status_code=404, detail="취소할 회원권을 찾을 수 없어요.")
    before = found.data[0]

    try:
        res = (supabase.table("memberships")
               .update({"deleted_at": _now_iso(), "status": "cancelled", "updated_at": _now_iso()})
               .eq("id", membership_id).eq("shop_id", shop.shop_id).execute())
    except Exception as e:
        logger.error("회원권 취소 실패: %s", e)
        raise HTTPException(status_code=502, detail="회원권 취소에 실패했어요. 잠시 후 다시 시도해 주세요.")

    after = res.data[0] if res.data else None
    write_audit_log(shop_id=shop.shop_id, table_name="memberships", record_id=membership_id,
                    action="update", user_id=shop.user_id, before_data=before, after_data=after)
    return {"ok": True}
