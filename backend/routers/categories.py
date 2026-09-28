# ===================================================================
# routers/categories.py  —  "분류(카테고리) 관리 API"  [분류 사용자 정의]
# -------------------------------------------------------------------
#   GET   /api/categories        : 내 가게 분류 목록(활성만, 정렬순) + 색 선택지
#   POST  /api/categories        : 분류 추가 (이름 필수, 색 6택1, value 자동발급)
#   PATCH /api/categories/{id}    : 분류 수정 (이름·색·정렬·숨김)
#
# 원칙:
#   - 분류에 기본값/프리셋은 없습니다. 가게가 직접 만든 것만 존재합니다.
#   - 삭제는 없습니다. 숨기려면 is_active=false 로 바꿉니다.
#   - 같은 가게 안에서 이름(label)은 중복 불가 → 중복이면 409 로 안내합니다.
#
# ★ 모든 API 는 Depends(CurrentShop) 검문소를 거쳐 내 가게 것만 다룹니다.
# ===================================================================

import logging
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.db import supabase
from backend.security import CurrentShop, ShopContext
from backend.categories import fetch_shop_categories, CATEGORY_COLORS, color_palette


logger = logging.getLogger("categories_api")

router = APIRouter(prefix="/api/categories", tags=["categories"])


# -------------------------------------------------------------------
# 입력 검증 틀
# -------------------------------------------------------------------
class CategoryCreate(BaseModel):
    label: str                 # 분류 이름 (필수)
    color: str                 # 색 키 (gold/gray/blue/green/red/purple 중 하나)


class CategoryUpdate(BaseModel):
    # 넷 다 선택 — 보낸 것만 바꿉니다.
    label: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


def _is_unique_violation(exc: Exception) -> bool:
    """DB의 unique(shop_id,label) 위반인지 대략 판별. (Postgres 코드 23505 / duplicate)"""
    text = str(exc).lower()
    return "23505" in text or "duplicate" in text or "unique" in text


# -------------------------------------------------------------------
# GET /api/categories  — 목록 + 색 선택지
#   - categories : 활성 분류만, sort_order 순 (관리 화면·필터가 씀)
#   - colors     : 추가/수정 화면에 보여줄 6색 선택지
# -------------------------------------------------------------------
@router.get("")
async def list_categories(shop: ShopContext = Depends(CurrentShop)):
    rows = fetch_shop_categories(shop.shop_id, active_only=True)
    return {"categories": rows, "colors": color_palette()}


# -------------------------------------------------------------------
# POST /api/categories  — 분류 추가
#   - 이름 필수 / 색은 6가지 중 하나 / value 는 'cat_'+랜덤 자동발급
#   - sort_order 는 '맨 뒤'(현재 최대+1)
#   - 이름 중복이면 409
# -------------------------------------------------------------------
@router.post("")
async def create_category(body: CategoryCreate, shop: ShopContext = Depends(CurrentShop)):
    label = (body.label or "").strip()
    if not label:
        raise HTTPException(status_code=422, detail="분류 이름을 입력해 주세요.")
    if body.color not in CATEGORY_COLORS:
        raise HTTPException(status_code=422, detail="색을 골라 주세요.")

    # 정렬 순서는 기존 분류(숨김 포함)의 최대 sort_order + 1 로 맨 뒤에 둡니다.
    existing = fetch_shop_categories(shop.shop_id, active_only=False)
    next_order = max([c.get("sort_order", 0) for c in existing], default=-1) + 1

    # value 는 사람이 안 보는 내부 식별자라 랜덤으로 만듭니다. (예: cat_9f2a1c7b)
    value = "cat_" + secrets.token_hex(4)

    try:
        res = supabase.table("shop_categories").insert({
            "shop_id": shop.shop_id,
            "value": value,
            "label": label,
            "color": body.color,
            "sort_order": next_order,
            "is_active": True,
        }).execute()
    except Exception as e:
        if _is_unique_violation(e):
            raise HTTPException(status_code=409, detail="이미 같은 이름의 분류가 있어요.")
        logger.error("분류 추가 실패: %s", e)
        raise HTTPException(status_code=502, detail="분류를 추가하지 못했어요. 잠시 후 다시 시도해 주세요.")

    return {"ok": True, "category": res.data[0] if res.data else None}


# -------------------------------------------------------------------
# PATCH /api/categories/{id}  — 분류 수정 (이름·색·정렬·숨김)
#   - 보낸 항목만 바꿉니다. 이름 중복이면 409.
#   - 내 가게 분류만 수정 가능(shop_id 로 소유권 검증).
# -------------------------------------------------------------------
@router.patch("/{category_id}")
async def update_category(
    category_id: str,
    body: CategoryUpdate,
    shop: ShopContext = Depends(CurrentShop),
):
    updates: dict = {}

    if body.label is not None:
        label = body.label.strip()
        if not label:
            raise HTTPException(status_code=422, detail="분류 이름을 입력해 주세요.")
        updates["label"] = label
    if body.color is not None:
        if body.color not in CATEGORY_COLORS:
            raise HTTPException(status_code=422, detail="색을 골라 주세요.")
        updates["color"] = body.color
    if body.sort_order is not None:
        updates["sort_order"] = body.sort_order
    if body.is_active is not None:
        updates["is_active"] = body.is_active

    if not updates:
        raise HTTPException(status_code=422, detail="바꿀 내용이 없어요.")

    try:
        res = (
            supabase.table("shop_categories")
            .update(updates)
            .eq("id", category_id)
            .eq("shop_id", shop.shop_id)   # ★ 남의 가게 분류 못 건드리게
            .execute()
        )
    except Exception as e:
        if _is_unique_violation(e):
            raise HTTPException(status_code=409, detail="이미 같은 이름의 분류가 있어요.")
        logger.error("분류 수정 실패(id=%s): %s", category_id, e)
        raise HTTPException(status_code=502, detail="분류를 수정하지 못했어요. 잠시 후 다시 시도해 주세요.")

    if not res.data:
        raise HTTPException(status_code=404, detail="분류를 찾을 수 없어요.")

    return {"ok": True, "category": res.data[0]}
