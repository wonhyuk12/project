# ===================================================================
# scripts/migrate_categories.py  —  "기존 기록의 분류를 shop_categories 로 옮기는 1회용 스크립트"
# -------------------------------------------------------------------
# 왜 필요한가요?  [분류 사용자 정의]
#   - 이제 분류는 가게가 만든 shop_categories 에서만 옵니다.
#   - 그런데 예전에 이미 category='gold' 처럼 저장된 기록이 있는 가게는,
#     shop_categories 에 그 값이 없으면 목록 뱃지가 회색 원시값으로 깨져 보입니다.
#   - 그래서 이 스크립트가 '기존 기록에 실제로 쓰인 분류 값'을 훑어,
#     그 값 그대로 shop_categories 에 행을 만들어 줍니다. (뱃지가 안 깨지게)
#   - 새로 만든 가게(기존 기록 없음)에는 아무것도 넣지 않습니다.
#
# 무엇을 넣나요?
#   - value : 기존에 쓰이던 값 그대로 (예: 'gold') — 기존 기록과 그대로 이어지도록.
#   - label : 표시명. gold→금, silver→은, other→기타. 그 외 값은 값 그대로.
#   - color : gold→금색, silver→회색, other→파랑. 그 외 값은 회색.
#   - sort_order : 기록에 등장한 순서대로 0,1,2...
#
# 실행 방법 (Gold_plaza 폴더에서, 가상환경 python 으로):
#   goldbusiness\Scripts\python.exe -m scripts.migrate_categories
#   (-m 으로 '모듈'로 실행해야 backend import 가 됩니다.)
#
# ※ service key(관리자 키)로 동작하므로 서버 안(내 PC)에서만 실행하세요.
# ※ 여러 번 돌려도 안전합니다: 이미 있는 value 는 건너뜁니다.
# ===================================================================

from backend.db import supabase

# 기존 값 → (표시명, 색키) 매핑. 여기 없는 값은 (값 그대로, 회색).
LABEL_COLOR_MAP = {
    "gold":   ("금", "gold"),
    "silver": ("은", "gray"),
    "other":  ("기타", "blue"),
}


def main() -> None:
    print("=" * 55)
    print(" 기존 분류 → shop_categories 마이그레이션 시작")
    print("=" * 55)

    # (1) 모든 입고 기록에서 (shop_id, category) 를 모읍니다.
    rows = supabase.table("intake_records").select("shop_id, category").execute().data or []

    # (2) 가게별로, '등장한 순서'를 유지하며 중복 없이 분류 값을 모읍니다.
    by_shop: dict[str, list[str]] = {}
    for r in rows:
        cat = r.get("category")
        if not cat:
            continue  # 분류 없이 저장된 기록은 대상 아님
        shop_id = r["shop_id"]
        seen = by_shop.setdefault(shop_id, [])
        if cat not in seen:
            seen.append(cat)

    if not by_shop:
        print("옮길 분류가 없습니다. (기존 기록에 분류가 없음)")
        return

    # (3) 가게마다 shop_categories 에 없는 값만 새로 만듭니다.
    total_added = 0
    for shop_id, cats in by_shop.items():
        existing = (
            supabase.table("shop_categories")
            .select("value, sort_order")
            .eq("shop_id", shop_id)
            .execute()
            .data
            or []
        )
        existing_values = {e["value"] for e in existing}
        # 이어붙일 정렬 시작점 = 기존 최대 sort_order + 1 (없으면 0)
        order = max([e.get("sort_order", 0) for e in existing], default=-1) + 1

        for cat in cats:
            if cat in existing_values:
                continue  # 이미 있으면 건너뜀 (여러 번 실행해도 안전)
            label, color = LABEL_COLOR_MAP.get(cat, (cat, "gray"))
            try:
                supabase.table("shop_categories").insert({
                    "shop_id": shop_id,
                    "value": cat,
                    "label": label,
                    "color": color,
                    "sort_order": order,
                    "is_active": True,
                }).execute()
                print(f"  + shop={shop_id[:8]}.. value={cat} label={label} color={color} order={order}")
                total_added += 1
                order += 1
            except Exception as e:
                print(f"  ! shop={shop_id[:8]}.. value={cat} 실패: {e}")

    print("-" * 55)
    print(f" 완료. 새로 만든 분류: {total_added}개 (가게 {len(by_shop)}곳 확인)")


if __name__ == "__main__":
    main()
