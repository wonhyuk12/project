# ===================================================================
# routers/failures.py  —  "AI 인식 실패 기록 조회 API"  [입고 최종판]
# -------------------------------------------------------------------
#   GET /api/ai-failures : 내 가게의 'AI 사진 인식 실패' 목록
#     - 실패 사진도 버리지 않고 남겨두었다가(ai_failures 테이블), 여기서 조회합니다.
#     - 각 실패는 나중에 '직접 입력'으로 저장하면 그 입고에 연결되어 '해결됨'이 됩니다.
#       (resolved_intake_id 가 채워지면 해결된 것)
#
# ★ 이 API 도 Depends(CurrentShop) 검문소를 거쳐, 내 가게 실패만 봅니다.
# ===================================================================

import logging

from fastapi import APIRouter, Depends

from backend.db import supabase
from backend.security import CurrentShop, ShopContext
# 사진을 잠깐 볼 수 있는 signed URL 로 바꾸는 도우미를 입고 라우터에서 그대로 재사용합니다.
from backend.routers.intake import _make_signed_url


logger = logging.getLogger("failures")

router = APIRouter(prefix="/api/ai-failures", tags=["ai-failures"])


# -------------------------------------------------------------------
# GET /api/ai-failures
#   - 내 가게(shop_id)의 실패 기록을 최신순으로 돌려줍니다.
#   - 각 항목에 사진 signed URL 과 '해결 여부(resolved)'를 붙여 줍니다.
#     · resolved      : 이미 직접 입력으로 정상화됐는지 (resolved_intake_id 가 있으면 True)
#     · resolved_intake_id : 해결됐다면 연결된 입고 기록 id (상세로 이동할 때 사용)
# -------------------------------------------------------------------
@router.get("")
async def list_ai_failures(shop: ShopContext = Depends(CurrentShop)):
    try:
        result = (
            supabase.table("ai_failures")
            .select("id, photo_url, error_message, ai_model, resolved_intake_id, created_at")
            .eq("shop_id", shop.shop_id)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as e:
        logger.error("실패 목록 조회 실패: %s", e)
        # 실패 목록을 못 불러와도 화면(정산)은 떠야 하므로 빈 목록으로 돌려줍니다.
        return {"failures": []}

    failures = result.data or []
    for f in failures:
        photo_path = f.get("photo_url")
        f["photo_signed_url"] = _make_signed_url(photo_path) if photo_path else None
        f["resolved"] = f.get("resolved_intake_id") is not None

    return {"failures": failures}
