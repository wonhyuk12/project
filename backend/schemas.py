# ===================================================================
# schemas.py  —  "데이터가 올바른 모양인지 검사하는 틀(Pydantic 모델)"
# -------------------------------------------------------------------
# Pydantic 모델이 뭔가요?
#   - "이 데이터에는 이런 항목들이 있고, 각 항목은 이런 종류여야 한다"를
#     정해두는 '틀'이에요. 틀에 안 맞으면 자동으로 걸러냅니다.
#
# ※ [Phase 5-A] 업종별 설정 전환:
#   - 입고 저장/수정은 이제 필드가 업종마다 달라서, 고정된 항목 대신
#     fields(딕셔너리) 하나로 받습니다. { "item_name": "...", "brand": "...", ... }
#   - '분류가 그 업종의 허용값인지', '품목명이 비었는지' 같은 검증은
#     업종을 알아야 하므로 이 틀이 아니라 라우터(routers/intake.py)에서 합니다.
# ===================================================================

from typing import Optional, Any
from pydantic import BaseModel, field_validator

from backend.field_config import OUTGO_CHANNEL_VALUES   # ["store","phone","other"]


# -------------------------------------------------------------------
# 1) IntakeConfirm : 신규 입고 저장 요청  [Phase 5-A: fields 딕셔너리로]
#    - fields : 업종 설정에 정의된 필드들의 값 { key: value }
#               (예: gold → item_name/category/weight_g/purity/purchase_price/memo)
#               (예: luxury → item_name/category/brand/model/grade/purchase_price/memo)
#    - shop_id 는 여기 없습니다! 검문소가 알아낸 값을 서버가 붙입니다.
#    - 값 검증(분류 허용값 등)은 라우터에서 업종 설정 기준으로 합니다.
# -------------------------------------------------------------------
class IntakeConfirm(BaseModel):
    fields: dict[str, Any] = {}     # 업종 필드 값들

    photo_url: str                  # analyze 단계에서 저장된 사진 경로 (필수)
    ai_raw: Optional[Any] = None    # Gemini 가 준 원본(그대로 보관용)

    # AI 인식이 실패해 '직접 입력'으로 저장하는 경우, 그 실패 기록(ai_failures)의 id.
    #   - 있으면: 이 입고를 ai_status='failed_manual' 로 저장하고, 그 실패 기록을 '해결됨'으로 연결.
    #   - 없으면: 정상 인식(ai_status='success').
    failure_id: Optional[str] = None

    # --- AI 분석 부가정보 (사용자에겐 안 보임 / analyze 응답을 프론트가 되돌려줌) ---
    ai_model: Optional[str] = None
    ai_latency_ms: Optional[int] = None
    ai_tokens_input: Optional[int] = None
    ai_tokens_output: Optional[int] = None


# -------------------------------------------------------------------
# 2) IntakeUpdate : 상세 화면에서 기존 입고를 수정  [Phase 5-A: fields 딕셔너리로]
#    - 수정 화면이 그 업종의 필드를 담아 보냅니다.
#    - 품목명 필수/분류 허용값 검증은 라우터에서 합니다.
# -------------------------------------------------------------------
class IntakeUpdate(BaseModel):
    fields: dict[str, Any] = {}


# -------------------------------------------------------------------
# 3) OutgoConfirm : 재고 물건을 '판매'할 때 보내는 데이터  [Phase 2: 출고]
# -------------------------------------------------------------------
class OutgoConfirm(BaseModel):
    intake_id: str                       # 판매할 재고 id (필수)
    sale_price: int                      # 판매가(원) (필수)
    channel: Optional[str] = None        # 판매 경로 (선택)
    memo: Optional[str] = None           # 메모 (선택)

    @field_validator("sale_price")
    @classmethod
    def sale_price_positive(cls, v: int) -> int:
        if v is None or v <= 0:
            raise ValueError("판매가를 올바르게 입력해 주세요.")
        return v

    @field_validator("channel")
    @classmethod
    def channel_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return None
        if v not in OUTGO_CHANNEL_VALUES:
            raise ValueError("판매 경로 값이 올바르지 않습니다.")
        return v


# -------------------------------------------------------------------
# 4) ExpenseCreate : 비용을 추가할 때 보내는 데이터  [Phase 3: 정산]
# -------------------------------------------------------------------
# -------------------------------------------------------------------
# 5) 회원(member) 등록/수정  [회원형 2탄]
#    - name 만 필수. 나머지(연락처·생년월일·메모·사진·등록일)는 선택.
#    - shop_id 는 여기 없습니다! 검문소가 알아낸 값을 서버가 붙입니다.
#    - birth/joined_at 은 'YYYY-MM-DD' 문자열로 받습니다(빈 값은 라우터에서 None 처리).
# -------------------------------------------------------------------
class MemberCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    birth: Optional[str] = None
    memo: Optional[str] = None
    photo_url: Optional[str] = None
    joined_at: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_required(cls, v: str) -> str:
        if v is None or v.strip() == "":
            raise ValueError("회원 이름을 입력해 주세요.")
        return v.strip()


class MemberUpdate(BaseModel):
    # 보낸 것만 바꿉니다. name 을 보냈다면 비어 있으면 안 됩니다(라우터에서 검사).
    name: Optional[str] = None
    phone: Optional[str] = None
    birth: Optional[str] = None
    memo: Optional[str] = None
    photo_url: Optional[str] = None
    joined_at: Optional[str] = None


# -------------------------------------------------------------------
# 6) 회원권 상품(membership_plans) 등록/수정  [회원형 2-2]
# -------------------------------------------------------------------
class PlanCreate(BaseModel):
    name: str
    kind: str = "period"                 # 'period'(기간권) | 'count'(횟수권)
    duration_days: Optional[int] = None  # 기간권 유효 일수
    total_count: Optional[int] = None    # 횟수권 총 횟수
    price: int = 0

    @field_validator("name")
    @classmethod
    def name_required(cls, v: str) -> str:
        if v is None or v.strip() == "":
            raise ValueError("상품 이름을 입력해 주세요.")
        return v.strip()

    @field_validator("kind")
    @classmethod
    def kind_valid(cls, v: str) -> str:
        if v not in ("period", "count"):
            raise ValueError("상품 종류가 올바르지 않습니다.")
        return v


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    kind: Optional[str] = None
    duration_days: Optional[int] = None
    total_count: Optional[int] = None
    price: Optional[int] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


# -------------------------------------------------------------------
# 7) 회원권 판매(memberships)  [회원형 2-2]
#    - 어떤 회원(member_id)에게 어떤 상품(plan_id)을 파는지.
#    - 시작일·가격은 선택(없으면 오늘/상품가). 상품 정보는 서버가 스냅샷으로 저장.
# -------------------------------------------------------------------
class MembershipCreate(BaseModel):
    member_id: str
    plan_id: str
    start_date: Optional[str] = None     # 'YYYY-MM-DD' (없으면 오늘)
    price_paid: Optional[int] = None     # 실제 받은 금액 (없으면 상품가)
    memo: Optional[str] = None


class ExpenseCreate(BaseModel):
    name: str                            # 비용 이름 (필수)
    amount: int                          # 금액(원) (필수)
    spent_at: Optional[str] = None       # 지출일 (선택)
    memo: Optional[str] = None           # 메모 (선택)

    @field_validator("name")
    @classmethod
    def name_required(cls, v: str) -> str:
        if v is None or v.strip() == "":
            raise ValueError("비용 이름을 입력해 주세요.")
        return v.strip()

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: int) -> int:
        if v is None or v <= 0:
            raise ValueError("금액을 올바르게 입력해 주세요.")
        return v
