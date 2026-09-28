# ===================================================================
# routers/attendance.py  —  "출석 체크 API"  [회원형 2-3]
# -------------------------------------------------------------------
#   POST   /api/attendances          : 출석 체크 (횟수권이면 잔여 -1)
#   GET    /api/attendances/today    : 오늘 출석한 회원 목록 (오늘 명단)
#   GET    /api/attendances?member_id= : 한 회원의 출석 이력
#   DELETE /api/attendances/{id}     : 출석 취소(소프트) — 횟수권이면 잔여 +1 되돌림
#
# ★ 모든 API 는 Depends(CurrentShop) 검문소를 거쳐 '내 가게' 것만 다룹니다.
#
# 출석 시 회원권 처리 규칙:
#   1) 활성 횟수권(잔여>0)이 있으면 → 그 회원권의 잔여를 1 깎고 이 출석에 연결.
#   2) 없고 기간권이 있으면 → 그 기간권에 연결(차감 없음).
#   3) 둘 다 없는데 '잔여 0인 횟수권'만 있으면 → 막고 안내(회원권 새로 판매 유도).
#   4) 회원권이 아예 없으면 → 그냥 출석만 기록(연결 없음).
# ===================================================================

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from backend.db import supabase
from backend.security import CurrentShop, ShopContext
from backend.audit import write_audit_log
from backend.routers.members import _fetch_member


logger = logging.getLogger("attendance")

router = APIRouter(prefix="/api/attendances", tags=["attendance"])

# 한국 시간(KST). '오늘'을 한국 기준으로 계산하려고 씁니다.
KST = timezone(timedelta(hours=9))


class AttendanceCreate(BaseModel):
    member_id: str
    method: str = "manual"
    memo: Optional[str] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_range_iso():
    """한국 시간 기준 '오늘 0시 ~ 내일 0시'를 ISO 문자열로 돌려줍니다."""
    now_kst = datetime.now(KST)
    start = now_kst.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start.isoformat(), end.isoformat()


# -------------------------------------------------------------------
# 1) POST /api/attendances  — 출석 체크
# -------------------------------------------------------------------
@router.post("")
async def check_in(body: AttendanceCreate, shop: ShopContext = Depends(CurrentShop)):
    member = _fetch_member(body.member_id, shop.shop_id, only_alive=True)
    if member is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없어요.")

    method = body.method if body.method in ("manual", "qr") else "manual"

    # (1) 오늘 이미 출석했는지 확인 (한국시간 기준). 있으면 막습니다.
    start_iso, end_iso = _today_range_iso()
    try:
        dup = (
            supabase.table("attendances").select("id")
            .eq("shop_id", shop.shop_id).eq("member_id", body.member_id)
            .is_("deleted_at", "null")
            .gte("checked_at", start_iso).lt("checked_at", end_iso)
            .limit(1).execute()
        )
    except Exception as e:
        logger.error("오늘 출석 확인 실패: %s", e)
        raise HTTPException(status_code=502, detail="출석 처리에 실패했어요. 잠시 후 다시 시도해 주세요.")
    if dup.data:
        raise HTTPException(status_code=409, detail="오늘 이미 출석했어요.")

    # (2) 이 회원의 활성 회원권을 보고, 어디에 연결할지(차감할지) 정합니다.
    try:
        ms = (
            supabase.table("memberships").select("*")
            .eq("shop_id", shop.shop_id).eq("member_id", body.member_id)
            .is_("deleted_at", "null").eq("status", "active")
            .order("created_at").execute()
        ).data or []
    except Exception as e:
        logger.error("회원권 조회 실패: %s", e)
        ms = []

    count_avail = [m for m in ms if m.get("kind") == "count" and (m.get("remaining_count") or 0) > 0]
    period_avail = [m for m in ms if m.get("kind") == "period"]
    count_exhausted = [m for m in ms if m.get("kind") == "count" and (m.get("remaining_count") or 0) <= 0]

    membership_id = None
    remaining_after = None
    if count_avail:
        chosen = count_avail[0]                      # 가장 오래된 잔여 있는 횟수권
        remaining_after = (chosen.get("remaining_count") or 0) - 1
        try:
            supabase.table("memberships").update(
                {"remaining_count": remaining_after, "updated_at": _now_iso()}
            ).eq("id", chosen["id"]).eq("shop_id", shop.shop_id).execute()
        except Exception as e:
            logger.error("잔여 횟수 차감 실패: %s", e)
            raise HTTPException(status_code=502, detail="출석 처리에 실패했어요. 잠시 후 다시 시도해 주세요.")
        membership_id = chosen["id"]
    elif period_avail:
        membership_id = period_avail[0]["id"]        # 기간권 연결(차감 없음)
    elif count_exhausted:
        # 쓸 수 있는 회원권이 '잔여 0 횟수권'뿐 → 막고 안내
        raise HTTPException(status_code=409, detail="남은 횟수가 없어요. 회원권을 새로 판매해 주세요.")
    # else: 회원권 없음 → membership_id 는 None (그냥 출석만 기록)

    # (3) 출석 저장
    row = {
        "shop_id": shop.shop_id,
        "member_id": body.member_id,
        "membership_id": membership_id,
        "method": method,
        "memo": (body.memo or "").strip() or None,
    }
    try:
        res = supabase.table("attendances").insert(row).execute()
    except Exception as e:
        logger.error("출석 저장 실패: %s", e)
        # 이미 잔여를 깎았으면 되돌립니다(정합성).
        if remaining_after is not None and membership_id:
            try:
                supabase.table("memberships").update(
                    {"remaining_count": remaining_after + 1}
                ).eq("id", membership_id).eq("shop_id", shop.shop_id).execute()
            except Exception:
                pass
        raise HTTPException(status_code=502, detail="출석 저장에 실패했어요. 잠시 후 다시 시도해 주세요.")

    saved = res.data[0] if res.data else None
    if saved:
        write_audit_log(shop_id=shop.shop_id, table_name="attendances", record_id=saved["id"],
                        action="create", user_id=shop.user_id, before_data=None, after_data=saved)
    # remaining_after: 이번에 차감한 뒤 잔여(횟수권일 때만). 프론트 안내용.
    return {"ok": True, "attendance": saved, "remaining": remaining_after}


# -------------------------------------------------------------------
# 2) GET /api/attendances/today  — 오늘 출석 명단 (회원 이름 포함)
# -------------------------------------------------------------------
@router.get("/today")
async def today_attendances(shop: ShopContext = Depends(CurrentShop)):
    start_iso, end_iso = _today_range_iso()
    try:
        res = (
            supabase.table("attendances")
            .select("id, member_id, checked_at, membership_id, members(name)")
            .eq("shop_id", shop.shop_id)
            .is_("deleted_at", "null")
            .gte("checked_at", start_iso).lt("checked_at", end_iso)
            .order("checked_at", desc=True).execute()
        )
    except Exception as e:
        logger.error("오늘 출석 조회 실패: %s", e)
        return {"attendances": []}
    out = []
    for a in (res.data or []):
        mem = a.get("members") or {}
        out.append({
            "id": a["id"], "member_id": a.get("member_id"),
            "checked_at": a.get("checked_at"), "membership_id": a.get("membership_id"),
            "member_name": mem.get("name"),
        })
    return {"attendances": out}


# -------------------------------------------------------------------
# 3) GET /api/attendances?member_id=  — 한 회원의 출석 이력
# -------------------------------------------------------------------
@router.get("")
async def member_attendances(
    member_id: str = Query(...),
    shop: ShopContext = Depends(CurrentShop),
):
    try:
        res = (
            supabase.table("attendances")
            .select("id, checked_at, method, membership_id")
            .eq("shop_id", shop.shop_id).eq("member_id", member_id)
            .is_("deleted_at", "null")
            .order("checked_at", desc=True).limit(50).execute()
        )
    except Exception as e:
        logger.error("출석 이력 조회 실패: %s", e)
        return {"attendances": []}
    return {"attendances": res.data or []}


# -------------------------------------------------------------------
# 4) DELETE /api/attendances/{id}  — 출석 취소(소프트) + 횟수권이면 잔여 +1
# -------------------------------------------------------------------
@router.delete("/{attendance_id}")
async def cancel_attendance(attendance_id: str, shop: ShopContext = Depends(CurrentShop)):
    try:
        found = (
            supabase.table("attendances").select("*")
            .eq("id", attendance_id).eq("shop_id", shop.shop_id)
            .is_("deleted_at", "null").limit(1).execute()
        )
    except Exception as e:
        logger.error("출석 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail="출석 취소에 실패했어요. 잠시 후 다시 시도해 주세요.")
    if not found.data:
        raise HTTPException(status_code=404, detail="취소할 출석을 찾을 수 없어요.")
    att = found.data[0]

    # 이 출석이 횟수권을 깎았던 거면, 그 회원권의 잔여를 1 되돌립니다.
    mid = att.get("membership_id")
    if mid:
        try:
            mr = (supabase.table("memberships").select("id, kind, remaining_count")
                  .eq("id", mid).eq("shop_id", shop.shop_id).limit(1).execute())
            if mr.data:
                mrow = mr.data[0]
                if mrow.get("kind") == "count" and mrow.get("remaining_count") is not None:
                    supabase.table("memberships").update(
                        {"remaining_count": (mrow["remaining_count"] or 0) + 1, "updated_at": _now_iso()}
                    ).eq("id", mid).eq("shop_id", shop.shop_id).execute()
        except Exception as e:
            logger.warning("잔여 횟수 되돌리기 실패(%s): %s", mid, e)

    try:
        supabase.table("attendances").update({"deleted_at": _now_iso()}) \
            .eq("id", attendance_id).eq("shop_id", shop.shop_id).execute()
    except Exception as e:
        logger.error("출석 취소 실패: %s", e)
        raise HTTPException(status_code=502, detail="출석 취소에 실패했어요. 잠시 후 다시 시도해 주세요.")

    write_audit_log(shop_id=shop.shop_id, table_name="attendances", record_id=attendance_id,
                    action="delete", user_id=shop.user_id, before_data=att, after_data=None)
    return {"ok": True}
