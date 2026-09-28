# ===================================================================
# categories.py  —  "가게별 분류(shop_categories) 도우미"  [분류 사용자 정의]
# -------------------------------------------------------------------
# 이 파일이 하는 일:
#   - 분류는 이제 업종 프리셋이 아니라, 가게가 직접 만든 shop_categories 에서만 옵니다.
#   - 여기 도우미들이 그 분류를 DB 에서 읽어와, 화면/프롬프트가 쓰는 모양으로 바꿔 줍니다.
#
# 색 저장 방식(중요):
#   - shop_categories.color 에는 '색 이름 키'(gold/gray/blue/green/red/purple)를 저장합니다.
#   - 테이블에는 글자색 컬럼이 없으므로, 여기 CATEGORY_COLORS 로 배경색+글자색을 함께 정합니다.
#   - 사장님은 6가지 중에서만 고릅니다. (아래 CATEGORY_COLORS 의 키/라벨)
# ===================================================================

import logging

from backend.db import supabase

logger = logging.getLogger("categories")


# 분류 뱃지에 쓸 6가지 색.  키 → {한국어라벨, 배경색(color), 글자색(text)}
CATEGORY_COLORS = {
    "gold":   {"label": "금색", "color": "#c9a227", "text": "#2a2100"},
    "gray":   {"label": "회색", "color": "#8a8f98", "text": "#ffffff"},
    "blue":   {"label": "파랑", "color": "#3b6bb0", "text": "#ffffff"},
    "green":  {"label": "초록", "color": "#2f8f5b", "text": "#ffffff"},
    "red":    {"label": "빨강", "color": "#c0392b", "text": "#ffffff"},
    "purple": {"label": "보라", "color": "#8e44ad", "text": "#ffffff"},
}
COLOR_KEYS = list(CATEGORY_COLORS.keys())   # 유효성 검사용
DEFAULT_COLOR_KEY = "gray"                    # 모르는 색이 오면 이 색으로


def resolve_color(key) -> dict:
    """색 이름 키('gold' 등) → {color(배경), text(글자)}. 모르는 키는 회색으로."""
    return CATEGORY_COLORS.get(key or "", CATEGORY_COLORS[DEFAULT_COLOR_KEY])


def color_palette() -> list[dict]:
    """분류 추가/수정 화면에 보여줄 6색 선택지. [{key, label, color, text}, ...]"""
    return [{"key": k, **v} for k, v in CATEGORY_COLORS.items()]


def fetch_shop_categories(shop_id: str, active_only: bool = True) -> list[dict]:
    """
    그 가게의 분류를 sort_order 순으로 돌려줍니다. (없으면 빈 리스트)
      - active_only=True 면 숨김(is_active=false)은 제외합니다.
      - 조회가 실패해도 화면(목록/정산)은 떠야 하므로, 실패 시 빈 리스트를 돌려줍니다.
    """
    try:
        q = (
            supabase.table("shop_categories")
            .select("id, value, label, color, sort_order, is_active")
            .eq("shop_id", shop_id)
        )
        if active_only:
            q = q.eq("is_active", True)
        res = q.order("sort_order").execute()
        return res.data or []
    except Exception as e:
        logger.error("분류 조회 실패(shop=%s): %s", shop_id, e)
        return []


def to_config_categories(rows) -> list[dict]:
    """
    shop_categories 행들을, 프론트/뱃지/프롬프트가 쓰는 모양으로 바꿉니다.
      [{value, label, color(배경), text(글자)}, ...]
      - color 이름 키를 실제 배경/글자색으로 풀어 줍니다.
    """
    out = []
    for r in (rows or []):
        c = resolve_color(r.get("color"))
        out.append({
            "value": r["value"],
            "label": r["label"],
            "color": c["color"],
            "text": c["text"],
        })
    return out
