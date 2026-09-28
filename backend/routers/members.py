# ===================================================================
# routers/members.py  —  "회원 관리 API"  [회원형 2탄 · 2-1 회원 CRUD]
# -------------------------------------------------------------------
#   GET    /api/members             : 내 가게 회원 목록 (이름·연락처 검색, 휴지통, 페이지네이션)
#   POST   /api/members/photo       : 회원 사진 업로드 (사진만 저장하고 photo_url 을 돌려줌)
#   POST   /api/members             : 회원 등록
#   GET    /api/members/{id}        : 회원 한 명 상세
#   PATCH  /api/members/{id}        : 회원 수정
#   DELETE /api/members/{id}        : 회원 소프트 삭제(휴지통)
#   POST   /api/members/{id}/restore: 휴지통 회원 복구
#
# ★ 모든 API 는 Depends(CurrentShop) 검문소를 거쳐 '내 가게' 회원만 다룹니다.
# ★ 기록은 사라지지 않는다: 삭제는 deleted_at 만 찍는 소프트 삭제이고, 모든 변경은 감사 로그에 남습니다.
# ※ 사진은 입고와 같은 저장소(버킷)를 재사용합니다(경로만 members 폴더로 분리).
# ===================================================================

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query

from backend.db import supabase
from backend.security import CurrentShop, ShopContext
from backend.image_utils import compress_image
from backend.schemas import MemberCreate, MemberUpdate
from backend.audit import write_audit_log
# 입고 라우터의 도우미/상수를 그대로 재사용합니다. (중복 방지)
from backend.routers.intake import _make_signed_url, PAGE_SIZE, BUCKET


logger = logging.getLogger("members")

router = APIRouter(prefix="/api/members", tags=["members"])

# 목록에서 뽑을 컬럼 (상세는 select("*"))
LIST_COLUMNS = "id, name, phone, birth, photo_url, joined_at, created_at, deleted_at"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(value):
    """빈 문자열/공백만 있으면 None 으로. (생년월일·연락처 등 빈칸을 null 로 저장)"""
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _fetch_member(member_id: str, shop_id: str, *, only_alive=False, only_deleted=False):
    """이 id 이면서 '내 가게' 회원 한 명을 통째로 가져옵니다. (없으면 None)"""
    q = supabase.table("members").select("*").eq("id", member_id).eq("shop_id", shop_id)
    if only_alive:
        q = q.is_("deleted_at", "null")
    if only_deleted:
        q = q.not_.is_("deleted_at", "null")
    res = q.limit(1).execute()
    return res.data[0] if res.data else None


# -------------------------------------------------------------------
# 1) GET /api/members  — 목록 (검색·휴지통·페이지네이션)
# -------------------------------------------------------------------
@router.get("")
async def list_members(
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
    q: str | None = Query(default=None),           # 이름·연락처 검색어
    trash: bool = Query(default=False),            # true 면 휴지통(삭제된 것만)
    offset: int = Query(default=0, ge=0),
):
    try:
        query = (
            supabase.table("members")
            .select(LIST_COLUMNS)
            .eq("shop_id", shop.shop_id)            # ★ 내 가게 회원만
        )
        # 휴지통 여부
        if trash:
            query = query.not_.is_("deleted_at", "null")
        else:
            query = query.is_("deleted_at", "null")
        # 검색: 이름 또는 연락처 부분일치 (PostgREST or 필터는 * 를 와일드카드로 씀)
        if q and q.strip():
            kw = q.strip()
            query = query.or_(f"name.ilike.*{kw}*,phone.ilike.*{kw}*")
        # 최신 등록순 + 페이지네이션 (21개 가져와 다음 페이지 유무 판단)
        query = query.order("created_at", desc=True).range(offset, offset + PAGE_SIZE)
        result = query.execute()
    except Exception as e:
        logger.error("회원 목록 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail="회원 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.")

    records = result.data or []
    has_more = len(records) > PAGE_SIZE
    if has_more:
        records = records[:PAGE_SIZE]

    for m in records:
        p = m.get("photo_url")
        m["photo_signed_url"] = _make_signed_url(p) if p else None

    return {"members": records, "has_more": has_more}


# -------------------------------------------------------------------
# 2) POST /api/members/photo  — 회원 사진 업로드 (사진만, AI 없음)
#    - 압축 후 저장소에 올리고 photo_url(경로)을 돌려줍니다.
#    - 프론트는 이 값을 회원 등록/수정 때 함께 보냅니다.
# -------------------------------------------------------------------
@router.post("/photo")
async def upload_member_photo(
    photo: UploadFile = File(...),
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    raw = await photo.read()
    if not raw:
        raise HTTPException(status_code=400, detail="사진이 비어 있어요. 다시 선택해 주세요.")
    try:
        compressed = compress_image(raw)
    except Exception as e:
        logger.error("회원 사진 압축 실패: %s", e)
        raise HTTPException(status_code=400, detail="사진 형식을 처리할 수 없어요. 다른 사진으로 시도해 주세요.")

    # 입고와 같은 버킷을 쓰되, 경로를 members 폴더로 분리합니다.
    path = f"{shop.shop_id}/members/{uuid.uuid4()}.jpg"
    try:
        supabase.storage.from_(BUCKET).upload(path, compressed, {"content-type": "image/jpeg"})
    except Exception as e:
        logger.error("회원 사진 업로드 실패: %s", e)
        raise HTTPException(status_code=502, detail="사진 저장에 실패했어요. 잠시 후 다시 시도해 주세요.")

    return {"photo_url": path, "photo_signed_url": _make_signed_url(path)}


# -------------------------------------------------------------------
# 3) POST /api/members  — 회원 등록
# -------------------------------------------------------------------
@router.post("")
async def create_member(
    body: MemberCreate,
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    row = {
        "shop_id": shop.shop_id,                   # ★ 토큰 값으로 강제
        "name": body.name,                          # 스키마에서 공백 정리·필수 검증됨
        "phone": _clean(body.phone),
        "birth": _clean(body.birth),
        "memo": _clean(body.memo),
        "photo_url": _clean(body.photo_url),
    }
    # 등록일을 보냈으면 쓰고, 없으면 DB 기본값(오늘)에 맡깁니다.
    joined = _clean(body.joined_at)
    if joined:
        row["joined_at"] = joined

    try:
        result = supabase.table("members").insert(row).execute()
    except Exception as e:
        logger.error("회원 등록 실패: %s", e)
        raise HTTPException(status_code=502, detail="회원 등록에 실패했어요. 잠시 후 다시 시도해 주세요.")

    saved = result.data[0] if result.data else None
    if saved:
        write_audit_log(
            shop_id=shop.shop_id, table_name="members", record_id=saved["id"],
            action="create", user_id=shop.user_id, before_data=None, after_data=saved,
        )
    return {"ok": True, "member": saved}


# -------------------------------------------------------------------
# 4) GET /api/members/{id}  — 회원 상세
#    - 삭제된(휴지통) 회원도 조회는 됩니다(복구 전에 내용 확인).
# -------------------------------------------------------------------
@router.get("/{member_id}")
async def get_member(
    member_id: str,
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    m = _fetch_member(member_id, shop.shop_id)
    if m is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없어요.")
    p = m.get("photo_url")
    m["photo_signed_url"] = _make_signed_url(p) if p else None
    return {"member": m}


# -------------------------------------------------------------------
# 5) PATCH /api/members/{id}  — 회원 수정
#    - 보낸 항목만 바꿉니다. 삭제된 회원은 수정 불가(복구 후에).
# -------------------------------------------------------------------
@router.patch("/{member_id}")
async def update_member(
    member_id: str,
    body: MemberUpdate,
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    before = _fetch_member(member_id, shop.shop_id, only_alive=True)
    if before is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없어요.")

    updates: dict = {}
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="회원 이름을 입력해 주세요.")
        updates["name"] = name
    # 나머지 필드는 '보냈으면' 빈칸→None 정리해서 반영
    for key in ("phone", "birth", "memo", "photo_url", "joined_at"):
        val = getattr(body, key)
        if val is not None:
            updates[key] = _clean(val)

    if not updates:
        raise HTTPException(status_code=422, detail="바꿀 내용이 없어요.")
    updates["updated_at"] = _now_iso()

    try:
        result = (
            supabase.table("members").update(updates)
            .eq("id", member_id).eq("shop_id", shop.shop_id).execute()
        )
    except Exception as e:
        logger.error("회원 수정 실패: %s", e)
        raise HTTPException(status_code=502, detail="회원 수정에 실패했어요. 잠시 후 다시 시도해 주세요.")

    after = result.data[0] if result.data else None
    if after:
        write_audit_log(
            shop_id=shop.shop_id, table_name="members", record_id=member_id,
            action="update", user_id=shop.user_id, before_data=before, after_data=after,
        )
    return {"ok": True, "member": after}


# -------------------------------------------------------------------
# 6) DELETE /api/members/{id}  — 소프트 삭제(휴지통)
# -------------------------------------------------------------------
@router.delete("/{member_id}")
async def delete_member(
    member_id: str,
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    before = _fetch_member(member_id, shop.shop_id, only_alive=True)
    if before is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없어요.")
    try:
        result = (
            supabase.table("members").update({"deleted_at": _now_iso()})
            .eq("id", member_id).eq("shop_id", shop.shop_id).execute()
        )
    except Exception as e:
        logger.error("회원 삭제 실패: %s", e)
        raise HTTPException(status_code=502, detail="회원 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.")

    after = result.data[0] if result.data else None
    write_audit_log(
        shop_id=shop.shop_id, table_name="members", record_id=member_id,
        action="delete", user_id=shop.user_id, before_data=before, after_data=after,
    )
    return {"ok": True}


# -------------------------------------------------------------------
# 7) POST /api/members/{id}/restore  — 휴지통에서 복구
# -------------------------------------------------------------------
@router.post("/{member_id}/restore")
async def restore_member(
    member_id: str,
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    before = _fetch_member(member_id, shop.shop_id, only_deleted=True)
    if before is None:
        raise HTTPException(status_code=404, detail="복구할 회원을 찾을 수 없어요.")
    try:
        result = (
            supabase.table("members").update({"deleted_at": None})
            .eq("id", member_id).eq("shop_id", shop.shop_id).execute()
        )
    except Exception as e:
        logger.error("회원 복구 실패: %s", e)
        raise HTTPException(status_code=502, detail="회원 복구에 실패했어요. 잠시 후 다시 시도해 주세요.")

    after = result.data[0] if result.data else None
    write_audit_log(
        shop_id=shop.shop_id, table_name="members", record_id=member_id,
        action="restore", user_id=shop.user_id, before_data=before, after_data=after,
    )
    return {"ok": True}
