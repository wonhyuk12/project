# ===================================================================
# families.py  —  "업종군(business family) 정의와 판별"  [3업종군 플랫폼]
# -------------------------------------------------------------------
# 업종군이 뭔가요?
#   - 이 서비스는 성격이 다른 3가지 사업을 한 플랫폼에서 담습니다:
#       · retail(재고형)        : 매입 → 재고 → 판매 (금은방·중고·전당포 등)   ← 지금 완성된 앱
#       · membership(회원형)    : 회원·회원권·출석·회비 (헬스장·태권도장 등)   ← 예정
#       · manufacturing(제조형) : 원재료 → 생산 → 판매 (음식점·공방·공장 등)   ← 예정
#   - '세부 업종(business_type, 예: gold)'보다 한 단계 위의 '큰 분류'입니다.
#
# 어떻게 정해지나요?
#   - 계정 발급 때 정한 세부 업종(business_type)으로 '자동 판별'합니다(아래 매핑).
#   - 매핑에 없는(=업종 미정) 계정은 첫 로그인 때 사장님이 한 번 고릅니다.
# ===================================================================

# 업종군 코드
FAMILY_RETAIL = "retail"
FAMILY_MEMBERSHIP = "membership"
FAMILY_MANUFACTURING = "manufacturing"

# 프론트 '시작 선택 화면'과 맞추는 업종군 메타.
#   status: 'ready'(지금 사용 가능) / 'coming_soon'(준비 중)
BUSINESS_FAMILIES = [
    {"key": FAMILY_RETAIL,        "label": "재고형", "desc": "매입 → 재고 → 판매",   "status": "ready"},
    {"key": FAMILY_MEMBERSHIP,    "label": "회원형", "desc": "회원·회원권·출석·회비", "status": "coming_soon"},
    {"key": FAMILY_MANUFACTURING, "label": "제조형", "desc": "원재료 → 생산 → 판매", "status": "coming_soon"},
]

# 세부 업종(business_type) → 업종군.
#   - 여기 없는 값(예: "unset", 빈 값, 아직 안 만든 회원형/제조형 업종)은 '미정'(None)으로 봅니다.
#   - 2·3탄에서 회원형/제조형 세부 업종을 추가하면 여기에 함께 등록합니다.
BUSINESS_TYPE_FAMILY = {
    "gold":    FAMILY_RETAIL,
    "luxury":  FAMILY_RETAIL,
    "watch":   FAMILY_RETAIL,
    "phone":   FAMILY_RETAIL,
    "general": FAMILY_RETAIL,
}


def family_of(business_type: str | None) -> str | None:
    """세부 업종으로 업종군을 판별합니다. 매핑에 없으면 None(미정)."""
    return BUSINESS_TYPE_FAMILY.get(business_type or "")
