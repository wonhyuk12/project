# ===================================================================
# audit.py  —  "고친 흔적을 남기는 이력 기록기" (audit_logs 테이블 담당)
# -------------------------------------------------------------------
# 왜 필요한가요?
#   - 이 앱의 약속은 "기록은 사라지지 않고, 고친 흔적이 남는다" 입니다.
#   - 그래서 입고를 새로 만들거나(create), 고치거나(update),
#     삭제(delete)·복구(restore)할 때마다 audit_logs 에 한 줄씩 남깁니다.
#   - 나중에 상세 화면의 "수정 이력"에서 이 기록을 읽어 보여줍니다.
#
# ※ 이력은 '읽기 전용'입니다. 지우거나 고치는 기능은 만들지 않습니다.
# ===================================================================

import logging

from backend.db import supabase

logger = logging.getLogger("audit")

# 허용되는 행동(action) 값들. (오타로 엉뚱한 값이 들어가는 걸 막기 위한 참고용)
AUDIT_ACTIONS = ("create", "update", "delete", "restore")


def write_audit_log(
    *,
    shop_id: str,
    table_name: str,
    record_id: str,
    action: str,
    user_id: str,
    before_data: dict | None = None,
    after_data: dict | None = None,
) -> None:
    """
    audit_logs 에 이력 한 줄을 남깁니다.
      - shop_id     : 어느 가게의 기록인지 (다른 가게 이력과 섞이지 않게)
      - table_name  : 어떤 표에 대한 변경인지 (지금은 'intake_records')
      - record_id   : 바뀐 기록의 id
      - action      : create / update / delete / restore 중 하나
      - user_id     : 이 변경을 한 사람(사장님) id
      - before_data : 바뀌기 전 전체 값 (create 는 없음 → None)
      - after_data  : 바뀐 후 전체 값 (delete 는 없음 → None)

    ★ 설계 판단: 이력 기록이 실패하더라도 '본래 작업(저장/수정 등)'까지
      실패로 만들지는 않습니다. 대신 개발자 로그에 경고를 남깁니다.
      (사장님 입장에서 저장은 됐는데 에러만 뜨는 상황을 피하기 위함)
    """
    row = {
        "shop_id": shop_id,
        "table_name": table_name,
        "record_id": record_id,
        "action": action,
        "before_data": before_data,
        "after_data": after_data,
        "user_id": user_id,
    }
    try:
        supabase.table("audit_logs").insert(row).execute()
    except Exception as e:
        # 이력 남기기에 실패해도 본 작업은 계속 진행됨. 원인만 기록해 둠.
        logger.warning("이력(audit_logs) 기록 실패 [%s %s]: %s", action, record_id, e)
