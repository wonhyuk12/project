# ===================================================================
# create_shop.py  —  "새 가게(계정) 발급 스크립트" (관리자 = 나만 쓰는 도구)
# -------------------------------------------------------------------
# 이게 뭔가요?
#   - 사장님에게 줄 계정을 '한 번에' 만들어 주는 터미널 스크립트예요.
#   - 웹사이트에 회원가입 화면은 없습니다. 계정 발급은 관리자인 내가
#     이 스크립트로만 합니다. (사장님은 발급받은 이메일·비번으로 로그인만)
#
# 한 번 실행하면 크게 2단계로 만듭니다:
#   1) 로그인 계정        (Supabase Auth = auth.users)
#   2) 가게 + 계정↔가게 연결  (DB 함수 create_shop_with_owner 한 번 호출)
#      → 이 함수가 shops 에 가게를 넣고, shop_members 에 연결까지 '한 번에'
#        처리합니다. DB 함수라 둘 중 하나만 실패하면 자동으로 통째로 되돌아가서
#        (한 트랜잭션) 반쪽짜리 데이터가 남지 않습니다.
#      → 이 연결이 있어야 로그인했을 때 "이 계정 = 그 가게" 로 찾아집니다.
#
# 실행 방법 (Gold_plaza 폴더 안에서, 가상환경 python 으로):
#   goldbusiness\Scripts\python.exe -m backend.create_shop
#   (윈도우 명령프롬프트 기준. -m 으로 '모듈' 형태로 실행해야 import 가 됩니다.)
#
# ※ 이 스크립트는 service key(관리자 키)로 동작하므로, 서버 안(내 PC)에서만
#   실행하세요. 절대 사장님에게 주거나 공개 서버에 올리지 마세요.
# ===================================================================

import sys
import re   # 전화번호 형식(숫자·하이픈)을 검사하기 위해

# 백엔드가 쓰는 것과 '같은' Supabase 리모컨(service key)을 그대로 가져다 씁니다.
#   - config.py 가 .env 를 읽으므로, .env 에 키가 채워져 있어야 동작합니다.
from backend.db import supabase

# 업종 선택지(gold/luxury/watch/phone/general …)를 안내·검증하는 데 씁니다.
#   - 새 업종을 field_config.py 에 추가하면, 이 목록에도 자동으로 나타납니다.
from backend.field_config import BUSINESS_CONFIGS


def _ask(label: str, default: str | None = None, required: bool = True) -> str:
    """
    터미널에서 한 줄 입력을 받는 도우미.
      - default 가 있으면, 그냥 엔터만 쳤을 때 그 기본값이 들어갑니다.
      - required=True 인데 값이 비면, 다시 물어봅니다. (빈 채로 못 넘어감)
    """
    # 화면에 보여줄 안내문 만들기 (기본값이 있으면 [기본값] 표시)
    suffix = f" [{default}]" if default else ""
    while True:
        value = input(f"{label}{suffix}: ").strip()
        if not value and default is not None:
            return default          # 엔터만 → 기본값 사용
        if value:
            return value
        if not required:
            return ""               # 선택 항목이면 빈 값 허용
        print("  (값을 입력해 주세요.)")


def _ask_phone(label: str) -> str:
    """
    전화번호를 받는 도우미 (필수 항목).
      - 비어 있으면 다시 물어봅니다.
      - 숫자와 하이픈(-)만 허용하는 간단한 형식 검사. 다른 글자가 섞이면 다시 물어봅니다.
        (예: 02-123-4567, 010-1234-5678)
    """
    while True:
        value = input(f"{label}: ").strip()
        if not value:
            print("  (전화번호를 입력해 주세요.)")
            continue
        # 숫자(0-9)와 하이픈(-)으로만 이루어졌는지 + 숫자가 최소 1개는 있는지 확인.
        #   - 그 외 글자가 섞이거나, "-" 처럼 숫자가 하나도 없으면 거부합니다.
        if not re.fullmatch(r"[0-9-]+", value) or not any(ch.isdigit() for ch in value):
            print("  (숫자와 하이픈(-)만 입력할 수 있어요. 예: 010-1234-5678)")
            continue
        return value


def main() -> None:
    print("=" * 55)
    print(" 새 가게(계정) 발급 — 7가지를 입력하세요")
    print(" (업종/역할은 그냥 엔터 치면 기본값이 들어갑니다)")
    print("=" * 55)

    # -------------------------------------------------------------
    # (0) 7가지 입력받기
    #     이메일 / 비밀번호 / 가게이름 / 업종 / 역할 / 주소 / 전화번호
    #     ※ 전화번호는 필수이며, 숫자와 하이픈만 허용합니다.
    # -------------------------------------------------------------
    email = _ask("이메일")
    password = _ask("비밀번호")
    shop_name = _ask("가게이름")

    # 업종 선택: field_config.py 에 등록된 업종만 받습니다. (엔터만 치면 기본값 gold)
    #   - 아래 목록은 BUSINESS_CONFIGS 에서 자동으로 만들어지므로, 업종을 추가하면 같이 늘어납니다.
    print("\n[업종 선택] 아래 코드 중 하나를 입력하세요 (엔터만 치면 gold).")
    print("  ※ '미정' 을 입력하면 업종군 미정으로 발급됩니다.")
    print("     → 이 계정은 첫 로그인 때 사장님이 업종군(재고형/회원형/제조형)을 직접 고릅니다. [3업종군 플랫폼]")
    for code, cfg in BUSINESS_CONFIGS.items():
        print(f"  - {code}  ({cfg['label']})")
    while True:
        business_type = _ask("업종", default="gold")
        if business_type == "미정":
            business_type = "unset"   # 업종군 미정 계정 (family_of 가 None 으로 봄 → 선택 화면)
            break
        if business_type in BUSINESS_CONFIGS:
            break
        print(f"  (등록된 업종 코드거나 '미정' 이어야 해요: {', '.join(BUSINESS_CONFIGS)})")

    role = _ask("역할", default="owner")           # 보통 owner(사장)
    address = _ask("주소(선택, 없으면 엔터)", required=False)
    phone = _ask_phone("전화번호(필수)")            # 숫자·하이픈만, 빈 값이면 다시 물음

    # 비밀번호가 너무 짧으면 Supabase 가 거부합니다. 미리 살짝 안내.
    if len(password) < 6:
        print("\n[안내] 비밀번호는 보통 6자 이상이어야 합니다. 짧으면 아래에서 실패할 수 있어요.")

    print("\n계정을 만드는 중입니다...\n")

    # -------------------------------------------------------------
    # (1) 로그인 계정 만들기 (auth.users)
    #     - email_confirm=True : 이메일 인증 단계를 건너뛰어, 발급 즉시 로그인 가능.
    #     - 실패하면(예: 이미 있는 이메일) 여기서 멈춥니다.
    # -------------------------------------------------------------
    try:
        user_res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
        })
        user_id = user_res.user.id
    except Exception as e:
        print("[실패] 로그인 계정을 만들지 못했어요.")
        print("       원인:", e)
        print("       (이미 등록된 이메일이거나, 비밀번호 규칙에 안 맞을 수 있어요.)")
        sys.exit(1)

    print(f"  1/2 계정 생성 완료 (user_id={user_id})")

    # -------------------------------------------------------------
    # (2) 가게 + 계정↔가게 연결 (DB 함수 create_shop_with_owner 한 번 호출)
    #     - 이 함수가 shops 에 가게를 넣고, shop_members 에 연결까지 한 번에 합니다.
    #     - DB 함수(한 트랜잭션)라, 도중에 실패하면 가게·연결이 통째로 되돌아갑니다.
    #       → 그래서 여기서는 '가게 따로 롤백'이 필요 없고, 실패 시 앞서 만든
    #         로그인 계정만 되돌리면 됩니다.
    #     - 함수는 새로 만든 가게의 id(uuid)를 돌려줍니다.
    #     - 파라미터 이름(p_...)은 DB 함수 정의와 똑같이 맞춰야 합니다.
    # -------------------------------------------------------------
    try:
        rpc_res = supabase.rpc(
            "create_shop_with_owner",
            {
                "p_user_id": user_id,
                "p_shop_name": shop_name,
                "p_business_type": business_type,
                "p_address": address or None,   # 주소는 비었으면 None(null)
                "p_role": role,
                "p_phone": phone,               # 전화번호는 필수
            },
        ).execute()
        shop_id = rpc_res.data               # 함수가 돌려준 새 가게 id(uuid)
    except Exception as e:
        print("[실패] 가게를 만들지 못했어요. 방금 만든 계정을 되돌립니다.")
        print("       원인:", e)
        _cleanup_user(user_id)               # 계정 삭제(롤백)
        sys.exit(1)

    print(f"  2/2 가게 + 계정↔가게 연결 완료 (shop_id={shop_id})\n")

    # -------------------------------------------------------------
    # (4) 완료 안내 — 이 내용을 사장님에게 전달하면 됩니다.
    # -------------------------------------------------------------
    print("=" * 55)
    print(" 발급 완료! 아래 정보를 사장님에게 전달하세요.")
    print("=" * 55)
    print(f"  가게이름 : {shop_name}")
    print(f"  업종     : {business_type}")
    print(f"  전화번호 : {phone}")
    if address:
        print(f"  주소     : {address}")
    print(f"  역할     : {role}")
    print("  ---- 로그인 정보 ----")
    print(f"  이메일   : {email}")
    print(f"  비밀번호 : {password}")
    print("=" * 55)
    print(" 사장님은 이 이메일·비밀번호로 웹사이트에서 바로 로그인하면 됩니다.")


# -------------------------------------------------------------------
# 롤백(되돌리기) 도우미
#   - 가게 만들기(rpc) 단계에서 실패했을 때, 앞서 만든 로그인 계정을 지워
#     찌꺼기를 안 남깁니다.
#   - 되돌리기 자체가 또 실패해도 프로그램이 안 죽게 감싸고, 무엇을 손으로
#     지워야 하는지 안내합니다.
#   ※ 가게·연결은 DB 함수(한 트랜잭션)라 실패 시 자동으로 되돌아가므로,
#     여기서 따로 지울 필요가 없습니다. (그래서 가게 롤백 도우미는 없음)
# -------------------------------------------------------------------
def _cleanup_user(user_id: str) -> None:
    try:
        supabase.auth.admin.delete_user(user_id)
        print(f"       (되돌림) 계정 {user_id} 삭제함")
    except Exception as e:
        print(f"       (주의) 계정 {user_id} 을 자동 삭제하지 못했어요. 대시보드에서 직접 지워 주세요. 원인: {e}")


if __name__ == "__main__":
    main()
