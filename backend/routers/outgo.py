# ===================================================================
# routers/outgo.py  —  "출고(판매) 관련 API 3개"  [Phase 2]
# -------------------------------------------------------------------
#   POST /api/outgo/confirm       : 재고 물건을 판매 처리 (+ 재고 상태를 sold 로)
#   GET  /api/outgo/list          : 판매된(취소 안 된) 목록
#   POST /api/outgo/{id}/cancel   : 판매 취소 (소프트 취소 + 재고 되돌림)
#
# ★ 모든 API 는 intake 와 똑같이 Depends(CurrentShop) 검문소를 거칩니다.
#   → 로그인 확인 + shop_id 확보가 강제되어, 다른 가게 데이터가 섞이지 않습니다.
#
# ※ 설계 메모 (판매 취소 방식)
#   - intake_records 에는 deleted_at 이 있어 소프트 삭제(휴지통)를 썼지만,
#     outgo_records 에는 그런 칸이 없고 마이그레이션도 하지 않기로 했습니다.
#   - 그래서 '판매 취소'는 outgo 행을 실제로 지우지 않고,
#     attributes(jsonb)에 cancelled_at(취소 시각)을 적어 표시만 합니다(소프트 취소).
#     목록/상세 조회는 "cancelled_at 이 없는 것(=취소 안 됨)"만 보여줍니다.
#   - "기록은 사라지지 않는다"는 이 앱의 약속과 일치합니다.
# ===================================================================

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File

from backend.db import supabase
from backend.security import CurrentShop, ShopContext
from backend.schemas import OutgoConfirm
from backend.audit import write_audit_log
from backend.image_utils import compress_image          # [코드 판매] 사진 압축
from backend.gemini import analyze_image                 # [코드 판매] 사진에서 코드 읽기
from backend.field_config import build_code_prompt       # [코드 판매] 코드만 읽는 프롬프트
# intake 라우터에서 만든 도우미/상수를 그대로 재사용합니다. (중복 방지)
from backend.routers.intake import _make_signed_url, PAGE_SIZE


logger = logging.getLogger("outgo")

router = APIRouter(prefix="/api/outgo", tags=["outgo"])


# 지금 시각을 ISO 문자열(UTC)로. (updated_at / cancelled_at 기록용)
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# -------------------------------------------------------------------
# 0) POST /api/outgo/lookup-by-code   [코드 판매 2단계]
#    - 판매하려는 물건 사진을 받아 AI 로 '품목 코드'를 읽고,
#      그 코드의 재고(in_stock)를 전부 찾아 '분기 정보'를 돌려줍니다.
#    - 사진은 저장하지 않습니다. (코드만 읽는 용도라 저장소에 안 올림)
#
#    돌려주는 mode:
#      · exact      : 재고 1건 → 프론트가 바로 판매 팝업
#      · code_group : 재고 여러 건 → 프론트가 목록(오래된 순)에서 고르게
#      · none       : 재고 0건 (sold_exists 로 '최근 같은 코드 판매됨'을 알려 줌)
#      · no_code    : 사진에서 코드를 못 읽음 → 다시 찍기 안내
# -------------------------------------------------------------------
@router.post("/lookup-by-code")
async def lookup_by_code(
    photo: UploadFile = File(...),                 # 판매할 물건 사진
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    raw = await photo.read()
    if not raw:
        raise HTTPException(status_code=400, detail="사진이 비어 있어요. 다시 찍어 주세요.")

    try:
        compressed = compress_image(raw)
    except Exception as e:
        logger.error("이미지 압축 실패: %s", e)
        raise HTTPException(status_code=400, detail="사진 형식을 처리할 수 없어요. 다른 사진으로 시도해 주세요.")

    # (1) 사진에서 코드만 읽습니다. 아예 못 읽으면(에러/코드 null) mode='no_code'.
    try:
        ai_raw, _meta = analyze_image(compressed, build_code_prompt())
    except HTTPException:
        return {"mode": "no_code", "code": None, "records": [], "sold_exists": False}

    code = (ai_raw or {}).get("short_code")
    code = str(code).strip() if code not in (None, "") else None
    if not code:
        return {"mode": "no_code", "code": None, "records": [], "sold_exists": False}

    # (2) 그 코드의 '재고(in_stock, 안 지워짐)'를 입고일 오래된 순으로 조회합니다.
    try:
        res = (
            supabase.table("intake_records")
            .select("id, item_name, weight_g, purchase_price, photo_url, created_at, short_code")
            .eq("shop_id", shop.shop_id)     # ★ 내 가게만
            .eq("short_code", code)
            .is_("deleted_at", "null")
            .eq("status", "in_stock")
            .order("created_at")             # asc = 가장 오래된 입고가 맨 위
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        logger.error("코드 재고 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail="재고를 조회하지 못했어요. 잠시 후 다시 시도해 주세요.")

    # 사진을 잠깐 볼 수 있는 signed URL 로 (썸네일용)
    for r in rows:
        p = r.get("photo_url")
        r["photo_signed_url"] = _make_signed_url(p) if p else None

    if len(rows) == 1:
        return {"mode": "exact", "code": code, "records": rows, "sold_exists": False}
    if len(rows) > 1:
        return {"mode": "code_group", "code": code, "records": rows, "sold_exists": False}

    # (3) 재고 0건: 최근 '판매된(sold)' 동일 코드가 있는지 알려 줍니다. (안내용)
    sold_exists = False
    try:
        s = (
            supabase.table("intake_records")
            .select("id")
            .eq("shop_id", shop.shop_id)
            .eq("short_code", code)
            .is_("deleted_at", "null")
            .eq("status", "sold")
            .limit(1)
            .execute()
        )
        sold_exists = bool(s.data)
    except Exception as e:
        logger.warning("판매된 동일코드 조회 실패: %s", e)

    return {"mode": "none", "code": code, "records": [], "sold_exists": sold_exists}


# -------------------------------------------------------------------
# 1) POST /api/outgo/confirm
#    - 재고(in_stock) 물건 하나를 판매 처리합니다.
#    - 한 흐름으로: outgo 저장 → intake.status='sold' → 이력 기록.
#    - 이미 팔린 물건이면 409 로 막습니다.
# -------------------------------------------------------------------
@router.post("/confirm")
async def confirm(
    body: OutgoConfirm,                            # 판매 데이터 (검증 통과)
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    # (1) 판매할 재고가 '내 가게 것 + 안 지워짐'인지 확인하고, 현재 상태를 봅니다.
    try:
        found = (
            supabase.table("intake_records")
            .select("*")
            .eq("id", body.intake_id)
            .eq("shop_id", shop.shop_id)   # ★ 남의 가게 재고 판매 차단
            .is_("deleted_at", "null")     # 휴지통에 있는 건 팔 수 없음
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.error("재고 확인 실패: %s", e)
        raise HTTPException(status_code=502, detail="판매 처리에 실패했어요. 잠시 후 다시 시도해 주세요.")

    if not found.data:
        raise HTTPException(status_code=404, detail="판매할 재고를 찾을 수 없어요.")

    item_before = found.data[0]
    # 이미 팔린 물건이면 중복 판매를 막습니다. (요구사항: 409)
    if item_before.get("status") == "sold":
        raise HTTPException(status_code=409, detail="이미 판매된 물건입니다.")

    # (2) 판매 기록(outgo_records) 저장. shop_id 는 토큰 값으로 강제.
    outgo_row = {
        "shop_id": shop.shop_id,
        "intake_id": body.intake_id,
        "sale_price": body.sale_price,
        "channel": body.channel,
        "memo": body.memo,
        # attributes 는 DB 기본값 {} 로 들어갑니다. (취소 시 여기에 cancelled_at 추가)
    }
    try:
        outgo_res = supabase.table("outgo_records").insert(outgo_row).execute()
    except Exception as e:
        logger.error("판매 저장 실패: %s", e)
        raise HTTPException(status_code=502, detail="판매 저장에 실패했어요. 잠시 후 다시 시도해 주세요.")

    outgo = outgo_res.data[0] if outgo_res.data else None

    # (3) 재고 상태를 sold 로 바꿉니다 (+ updated_at 갱신).
    #     - 여기서 실패하면 방금 넣은 판매 기록만 남아 재고와 안 맞으므로,
    #       판매 기록을 지워(롤백) 상태를 원래대로 되돌립니다.
    try:
        upd = (
            supabase.table("intake_records")
            .update({"status": "sold", "updated_at": _now_iso()})
            .eq("id", body.intake_id)
            .eq("shop_id", shop.shop_id)
            .execute()
        )
        item_after = upd.data[0] if upd.data else None
    except Exception as e:
        logger.error("재고 상태 변경 실패: %s", e)
        if outgo:
            _rollback_outgo(outgo["id"], shop.shop_id)
        raise HTTPException(status_code=502, detail="판매 처리에 실패했어요. 잠시 후 다시 시도해 주세요.")

    # (4) 이력 남기기.
    #     - 재고 상태 변화(in_stock → sold)를 intake_records 의 update 로 기록. (요구사항)
    #     - 판매 기록 생성도 outgo_records 의 create 로 함께 남깁니다.
    write_audit_log(
        shop_id=shop.shop_id,
        table_name="intake_records",
        record_id=body.intake_id,
        action="update",
        user_id=shop.user_id,
        before_data=item_before,
        after_data=item_after,
    )
    if outgo:
        write_audit_log(
            shop_id=shop.shop_id,
            table_name="outgo_records",
            record_id=outgo["id"],
            action="create",
            user_id=shop.user_id,
            before_data=None,
            after_data=outgo,
        )

    return {"ok": True, "outgo": outgo, "record": item_after}


# 판매 저장은 됐는데 재고 상태 변경이 실패했을 때, 판매 기록을 지워 되돌립니다.
#   - 이 되돌리기 자체가 또 실패해도 프로그램이 죽지 않게 감싸고 경고만 남깁니다.
def _rollback_outgo(outgo_id: str, shop_id: str) -> None:
    try:
        supabase.table("outgo_records").delete().eq("id", outgo_id).eq("shop_id", shop_id).execute()
        logger.warning("판매 기록 롤백(삭제)함: %s", outgo_id)
    except Exception as e:
        logger.error("판매 기록 롤백 실패(%s): %s", outgo_id, e)


# -------------------------------------------------------------------
# 2) GET /api/outgo/list
#    - 판매된(취소 안 된) 물건 목록을 최신순으로 돌려줍니다. (판매됨 탭)
#    - 각 판매에 연결된 재고(intake)의 품목명·분류·중량·매입가·사진을 함께 담고,
#      마진(판매가 − 매입가)을 계산해 넣어 줍니다.
#    - 20개씩 페이지네이션 (intake 목록과 같은 방식).
# -------------------------------------------------------------------
@router.get("/list")
async def list_records(
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
    offset: int = Query(default=0, ge=0),
):
    try:
        # intake_records 를 함께 끌어옵니다(임베드). intake_id 로 연결된 재고 정보.
        query = (
            supabase.table("outgo_records")
            .select(
                "id, sale_price, channel, memo, created_at, intake_id, "
                "intake_records(item_name, category, weight_g, purchase_price, photo_url)"
            )
            .eq("shop_id", shop.shop_id)
            .is_("attributes->>cancelled_at", "null")   # ★ 취소 안 된 판매만
            .order("created_at", desc=True)
            .range(offset, offset + PAGE_SIZE)
        )
        result = query.execute()
    except Exception as e:
        logger.error("판매 목록 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail="판매 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.")

    rows = result.data or []
    has_more = len(rows) > PAGE_SIZE
    if has_more:
        rows = rows[:PAGE_SIZE]

    # 프론트가 쓰기 쉽게 평평한 모양으로 정리합니다. (재고 정보 펼치기 + 마진 계산 + 사진 URL)
    records = []
    for r in rows:
        intake = r.get("intake_records") or {}
        purchase = intake.get("purchase_price")
        sale = r.get("sale_price")
        # 마진 = 판매가 − 매입가 (둘 다 있을 때만). +면 이익, −면 손해.
        margin = (sale - purchase) if (sale is not None and purchase is not None) else None
        photo_path = intake.get("photo_url")
        records.append({
            "outgo_id": r["id"],
            "intake_id": r.get("intake_id"),
            "item_name": intake.get("item_name"),
            "category": intake.get("category"),
            "weight_g": intake.get("weight_g"),
            "purchase_price": purchase,
            "sale_price": sale,
            "channel": r.get("channel"),
            "memo": r.get("memo"),
            "sold_at": r.get("created_at"),
            "margin": margin,
            "photo_signed_url": _make_signed_url(photo_path) if photo_path else None,
        })

    return {"records": records, "has_more": has_more}


# -------------------------------------------------------------------
# 3) POST /api/outgo/{outgo_id}/cancel
#    - 판매를 취소합니다. (소프트 취소)
#    - outgo 는 지우지 않고 attributes.cancelled_at 만 적고,
#      연결된 재고(intake)를 다시 in_stock 으로 되돌립니다.
#    - 이미 취소된 판매면 409.
# -------------------------------------------------------------------
@router.post("/{outgo_id}/cancel")
async def cancel_sale(
    outgo_id: str,
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    # (1) 내 가게의 판매 기록을 찾습니다.
    try:
        res = (
            supabase.table("outgo_records")
            .select("*")
            .eq("id", outgo_id)
            .eq("shop_id", shop.shop_id)   # ★ 남의 가게 판매 취소 차단
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.error("판매 기록 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail="판매 취소에 실패했어요. 잠시 후 다시 시도해 주세요.")

    if not res.data:
        raise HTTPException(status_code=404, detail="판매 기록을 찾을 수 없어요.")

    outgo_before = res.data[0]
    attrs = outgo_before.get("attributes") or {}
    if attrs.get("cancelled_at"):
        raise HTTPException(status_code=409, detail="이미 취소된 판매입니다.")

    intake_id = outgo_before.get("intake_id")
    now_iso = _now_iso()

    # (2) 판매 기록에 취소 표시를 남깁니다. (기존 attributes 를 지우지 않고 병합)
    new_attrs = dict(attrs)
    new_attrs["cancelled_at"] = now_iso
    try:
        upd_outgo = (
            supabase.table("outgo_records")
            .update({"attributes": new_attrs})
            .eq("id", outgo_id)
            .eq("shop_id", shop.shop_id)
            .execute()
        )
        outgo_after = upd_outgo.data[0] if upd_outgo.data else None
    except Exception as e:
        logger.error("판매 취소 표시 실패: %s", e)
        raise HTTPException(status_code=502, detail="판매 취소에 실패했어요. 잠시 후 다시 시도해 주세요.")

    # (3) 재고를 다시 in_stock 으로 되돌립니다 (+ updated_at).
    item_before = None
    item_after = None
    try:
        ib = (
            supabase.table("intake_records")
            .select("*")
            .eq("id", intake_id)
            .eq("shop_id", shop.shop_id)
            .limit(1)
            .execute()
        )
        item_before = ib.data[0] if ib.data else None
        if item_before is not None:
            ui = (
                supabase.table("intake_records")
                .update({"status": "in_stock", "updated_at": now_iso})
                .eq("id", intake_id)
                .eq("shop_id", shop.shop_id)
                .execute()
            )
            item_after = ui.data[0] if ui.data else None
    except Exception as e:
        # 판매는 이미 취소 표시됐으니, 재고 되돌리기 실패는 경고만 남깁니다.
        logger.warning("재고 되돌리기 실패(%s): %s", intake_id, e)

    # (4) 이력 남기기: 판매 취소(outgo update) + 재고 복귀(intake update).
    write_audit_log(
        shop_id=shop.shop_id,
        table_name="outgo_records",
        record_id=outgo_id,
        action="update",
        user_id=shop.user_id,
        before_data=outgo_before,
        after_data=outgo_after,
    )
    if item_before is not None and item_after is not None:
        write_audit_log(
            shop_id=shop.shop_id,
            table_name="intake_records",
            record_id=intake_id,
            action="update",
            user_id=shop.user_id,
            before_data=item_before,
            after_data=item_after,
        )

    return {"ok": True}
