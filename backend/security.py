# ===================================================================
# security.py  —  "모든 API 가 반드시 거쳐야 하는 검문소" (★ 멀티테넌트 안전의 핵심)
# -------------------------------------------------------------------
# 이 파일이 하는 일 (한 문장):
#   요청에 담겨온 '로그인 토큰'을 검사해서
#   → 누구인지(user_id) 확인하고
#   → 그 사람이 어느 가게 소속인지(shop_id) 알아내
#   → API 에게 "이 사람은 이 가게 사람" 이라고 알려준다.
#
# 왜 이렇게 하나요?
#   - 하나의 서버를 여러 가게가 함께 씁니다(멀티테넌트).
#   - 만약 어떤 API 가 shop_id 로 거르는 걸 깜빡하면,
#     다른 가게 데이터가 노출되는 심각한 사고가 납니다.
#   - 그래서 "로그인 확인 + shop_id 알아내기"를 이 한 곳에 모아,
#     모든 API 가 Depends(공통 의존성)로 강제로 통과하게 만듭니다.
#     → 각 API 코드에서 실수로 빠뜨릴 수 없게 하는 안전장치예요.
# ===================================================================

# fastapi 의 도구들:
#   - Depends   : "이 API 를 실행하기 전에 먼저 이 함수를 거쳐라" 라는 장치
#   - Header    : 요청 헤더에서 값을 꺼내는 도구
#   - HTTPException : 에러를 한국어 메시지와 함께 돌려줄 때 사용
from fastapi import Depends, Header, HTTPException

from backend.db import supabase  # service key 로 붙은 Supabase 리모컨


class ShopContext:
    """
    검문소를 통과한 뒤, API 에게 넘겨줄 '신분 정보 꾸러미'입니다.
      - user_id       : 로그인한 사용자(사장님)의 고유 ID
      - shop_id       : 그 사용자가 소속된 가게의 고유 ID
      - business_type : 그 가게의 업종 (gold/luxury 등). 업종별 설정을 고르는 데 씁니다. [Phase 5-A]
    API 들은 이 shop_id 로만 DB 를 조회/저장하고, business_type 으로 업종 설정을 고릅니다.
    """

    def __init__(self, user_id: str, shop_id: str, business_type: str | None = None):
        self.user_id = user_id
        self.shop_id = shop_id
        self.business_type = business_type


# -------------------------------------------------------------------
# 공통 의존성 함수
#   - authorization : 요청 헤더의 "Authorization" 값이 자동으로 들어옵니다.
#     프론트는 로그인 후  Authorization: Bearer <액세스토큰>  형태로 보냅니다.
# -------------------------------------------------------------------
def get_current_shop(authorization: str | None = Header(default=None)) -> ShopContext:
    """
    토큰을 검사하고 shop_id 를 알아내서 ShopContext 로 돌려줍니다.
    문제가 있으면 401/403 에러(한국어 안내)를 냅니다.
    """

    # (1) 토큰이 아예 없는 경우 → 로그인 안 한 상태
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다. 다시 로그인해 주세요.",
        )

    # (2) "Bearer <토큰>" 형식에서 실제 토큰만 꺼냅니다.
    #     예) "Bearer abc.def.ghi"  →  "abc.def.ghi"
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="로그인 정보 형식이 올바르지 않습니다. 다시 로그인해 주세요.",
        )
    access_token = parts[1]

    # (3) 토큰이 진짜 유효한지 Supabase 에게 물어봅니다.
    #     - 유효하면 사용자 정보를 돌려주고,
    #     - 만료/위조 등이면 예외가 나거나 user 가 비어 있습니다.
    try:
        user_response = supabase.auth.get_user(access_token)
    except Exception:
        # (개발자용 상세 오류는 화면에 노출하지 않고, 사용자에겐 한국어 안내만)
        raise HTTPException(
            status_code=401,
            detail="로그인이 만료되었어요. 다시 로그인해 주세요.",
        )

    # user 정보가 비어 있으면 토큰이 무효인 것으로 봅니다.
    if user_response is None or user_response.user is None:
        raise HTTPException(
            status_code=401,
            detail="로그인이 만료되었어요. 다시 로그인해 주세요.",
        )

    user_id = user_response.user.id  # 로그인한 사용자의 고유 ID

    # (4) 이 사용자가 어느 가게 소속인지 shop_members 에서 찾고,
    #     그 가게의 업종(business_type)도 함께 가져옵니다. (shops 를 임베드로 붙임) [Phase 5-A]
    member_result = (
        supabase.table("shop_members")
        .select("shop_id, shops(business_type)")
        .eq("user_id", user_id)   # 이 사용자에 해당하는 행만
        .limit(1)
        .execute()
    )

    # (5) 소속된 가게가 없으면 → 아직 가게에 연결되지 않은 계정
    if not member_result.data:
        raise HTTPException(
            status_code=403,
            detail="가게 정보가 없어요. 관리자에게 문의해 주세요.",
        )

    row = member_result.data[0]
    shop_id = row["shop_id"]

    # 임베드로 붙여온 shops 에서 업종을 꺼냅니다. (없으면 None → 설정이 기본 gold 로 대체)
    shop_info = row.get("shops")
    business_type = shop_info.get("business_type") if isinstance(shop_info, dict) else None

    # (6) 신분 꾸러미를 만들어 API 에게 넘겨줍니다.
    return ShopContext(user_id=user_id, shop_id=shop_id, business_type=business_type)


# 다른 파일에서 짧게 쓰기 위한 별칭입니다.
# API 함수에서  shop: ShopContext = Depends(CurrentShop)  처럼 사용해요.
CurrentShop = get_current_shop
