# ===================================================================
# routers/intake.py  —  "입고 관련 API 3개"
# -------------------------------------------------------------------
#   POST /api/intake/analyze : 사진 업로드 → 압축 → 저장소 업로드 → AI 인식
#   POST /api/intake/confirm : 확인 팝업에서 [저장] → DB 에 기록
#   GET  /api/intake/list    : 내 가게 최근 입고 20개 (사진은 signed URL)
#
# ★ 모든 API 는 Depends(CurrentShop) 검문소를 거칩니다.
#   → 로그인 확인 + shop_id 확보가 자동으로 강제되어, 다른 가게 데이터가 섞이지 않습니다.
# ===================================================================

import uuid          # 겹치지 않는 랜덤 파일 이름을 만들기 위해
import logging
from datetime import datetime, timezone  # 저장 경로용 연/월 + 삭제·수정 시각 기록용

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query

from backend.db import supabase
from backend.security import CurrentShop, ShopContext
from backend.image_utils import compress_image
from backend.gemini import analyze_image, GEMINI_MODEL   # 실패 기록에 '시도한 모델명'을 남기려고 함께 가져옴
from backend.schemas import IntakeConfirm, IntakeUpdate
from backend.audit import write_audit_log   # 고친 흔적을 audit_logs 에 남기는 도우미
# 업종별 설정 도우미 [Phase 5-A]
from backend.field_config import (
    get_business_config,      # 업종 설정 꺼내기
    business_fields,          # 업종 필드 + 공통(short_code) [코드 판매]
    category_values,          # 분류 목록 → value 들
    field_store,              # 필드를 컬럼/attributes 중 어디에 저장할지
    compare_fields,           # ai_was_edited 비교 대상 (key, 숫자여부)
    build_extraction_prompt,  # Gemini 프롬프트 (가게 분류를 넣어 만듦)
    clean_ai_fields,          # AI 결과를 그 업종 필드만 남겨 정리
    _to_number,               # 숫자 변환 (문자열 → 숫자)
)
# ★ [분류 사용자 정의] 분류는 그 가게가 만든 shop_categories 에서 옵니다.
from backend.categories import fetch_shop_categories


logger = logging.getLogger("intake")

# 사진을 저장할 Supabase Storage 버킷 이름 (비공개 버킷)
BUCKET = "intake-photos"


# -------------------------------------------------------------------
# ai_was_edited 계산에 쓰는 도우미들
#   - "AI 가 읽은 값"과 "사장님이 최종 저장한 값"을 필드별로 비교해서,
#     하나라도 다르면 True(사장님이 손봤다는 뜻)로 봅니다.
#   - 그냥 == 로 비교하면 오탐이 납니다. 예를 들면:
#       · AI 는 "18.75"(문자열)로, 사장님 저장값은 18.75(숫자)로 올 수 있음 → 같게 봐야 함
#       · 한쪽은 null, 다른쪽은 빈 문자열/공백 → 같게 봐야 함
#     그래서 비교 전에 아래 규칙으로 '정규화'한 뒤 비교합니다.
# -------------------------------------------------------------------

def _normalize_for_compare(value, is_number: bool):
    """
    비교하기 좋게 값을 '정규화'합니다.
      - None / 빈 문자열 / 공백만 있는 문자열  → 전부 None 으로 통일 (null↔"" 같게 취급)
      - 숫자필드면 float 로 바꿔서 돌려줌 ("18.75" 와 18.75 를 같게 만듦)
        · 숫자로 못 바꾸면 값이 없는 것(None)으로 취급
      - 글자필드면 앞뒤 공백 뗀 문자열로 통일
    """
    # null / 빈칸 계열은 모두 None 으로
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped == "":
            return None
        value = stripped

    if is_number:
        # 숫자 비교: 문자열이든 숫자든 float 로 맞춰 비교 (타입 차이 오탐 방지)
        try:
            return float(value)
        except (TypeError, ValueError):
            return None  # 숫자로 못 바꾸면 없는 값 취급
    # 글자 비교: 문자열로 통일
    return str(value)


def _compute_ai_was_edited(business_type, ai_raw, saved: dict) -> bool:
    """
    AI 원본(ai_raw)과 최종 저장값(saved)을 '그 업종의 필드'별로 비교해서,
    하나라도 다르면 True 를 돌려줍니다. (사장님이 AI 결과를 고쳤는지 여부)
      - ai_raw 가 딕셔너리가 아니면(없거나 이상하면) 빈 것으로 간주합니다.
      - 비교 대상 필드는 업종 설정에서 자동으로 가져옵니다(compare_fields).
    """
    ai = ai_raw if isinstance(ai_raw, dict) else {}
    for key, is_number in compare_fields(business_type):
        ai_val = _normalize_for_compare(ai.get(key), is_number)
        saved_val = _normalize_for_compare(saved.get(key), is_number)
        if ai_val != saved_val:
            return True  # 한 항목이라도 다르면 '수정됨'
    return False


# -------------------------------------------------------------------
# 입력 fields(딕셔너리) → DB 에 넣을 컬럼값/attributes 로 나누는 도우미  [Phase 5-A]
#   - 업종 설정에 정의된 필드만 사용합니다. (설정에 없는 임의 키는 무시 = 저장 안 함)
#   - 진짜 컬럼(item_name/category/weight_g/purity/purchase_price/memo)은 컬럼값으로,
#     그 밖의 추가 필드(brand/model/grade 등)는 attributes 로.
#   - 품목명 필수 / 분류 허용값 검증도 여기서 합니다. (아니면 422 한국어 안내)
#   돌려주는 값: (cfg, columns, attributes, flat)
#     · columns   : 컬럼에 넣을 값들
#     · attributes: attributes(jsonb)에 넣을 값들 (없으면 {})
#     · flat      : 컬럼+attributes 를 합친 것 (ai_was_edited 비교용)
# -------------------------------------------------------------------
def _build_intake_payload(business_type, fields, allowed_category_values):
    cfg = get_business_config(business_type)
    if not isinstance(fields, dict):
        fields = {}

    # 품목명 필수
    item_name = fields.get("item_name")
    if item_name is None or str(item_name).strip() == "":
        raise HTTPException(status_code=422, detail="품목명을 입력해 주세요.")

    # 분류 허용값 검증 (그 가게의 shop_categories 값이어야 함) [분류 사용자 정의]
    #   - 분류가 0개인 가게는 allowed 가 빈 리스트라, category 는 반드시 None 이어야 합니다.
    #     (프론트도 분류칸을 안 그리므로 보통 None 이 옵니다. 값이 오면 거부.)
    category = fields.get("category")
    if category is not None and category not in (allowed_category_values or []):
        raise HTTPException(status_code=422, detail="분류 값이 올바르지 않습니다.")

    columns: dict = {}
    attributes: dict = {}
    flat: dict = {}

    for f in business_fields(business_type):   # 업종 필드 + 공통(short_code)
        key = f["key"]
        value = fields.get(key)

        # 숫자 필드는 숫자로, 글자 필드는 앞뒤 공백 제거(빈칸은 None)
        if f["type"] == "number":
            value = _to_number(value)
        elif isinstance(value, str):
            value = value.strip() or None

        flat[key] = value
        if field_store(key) == "column":
            columns[key] = value
        else:
            attributes[key] = value

    # 품목명은 공백 정리해 확정
    columns["item_name"] = str(item_name).strip()
    flat["item_name"] = columns["item_name"]

    return cfg, columns, attributes, flat


# -------------------------------------------------------------------
# analyze 가 돌려주는 '확인 팝업용' 응답 모양  [입고 최종판]
#   - ai_failed=True 면 AI 인식만 실패한 것(사진 저장은 성공). 프론트는 이걸 보고
#     [다시 찍기]/[직접 입력] 버튼을 띄웁니다.
#   - failure_id : 실패를 남긴 ai_failures 행의 id. '직접 입력' 저장 때 되돌려보내
#     그 실패 기록을 '해결됨'으로 연결하는 데 씁니다.
#   - ai_meta 가 없으면(실패 시) 부가정보(모델/시간/토큰)는 전부 null 로 나갑니다.
# -------------------------------------------------------------------
def _analyze_response(photo_url, *, fields, ai_raw, ai_meta, ai_failed, failure_id=None):
    meta = ai_meta or {}
    return {
        "photo_url": photo_url,
        "fields": fields,
        "ai_raw": ai_raw,
        "ai_model": meta.get("ai_model"),
        "ai_latency_ms": meta.get("ai_latency_ms"),
        "ai_tokens_input": meta.get("ai_tokens_input"),
        "ai_tokens_output": meta.get("ai_tokens_output"),
        "ai_failed": ai_failed,
        "failure_id": failure_id,
    }


# -------------------------------------------------------------------
# AI 인식 실패를 ai_failures 에 한 줄 남기고 그 id 를 돌려줍니다.  [입고 최종판 B-1]
#   - 실패 사진(photo_url)은 이미 저장소에 올라가 있으므로 버리지 않고 기록합니다.
#   - 기록 자체가 실패해도 사용자 흐름은 계속돼야 하므로, 그때는 None 을 돌려줍니다.
# -------------------------------------------------------------------
def _record_ai_failure(shop_id: str, photo_url: str, exc: Exception) -> str | None:
    # HTTPException 이면 사용자용 메시지(detail)를, 아니면 예외 문자열을 에러 메시지로 저장.
    error_message = getattr(exc, "detail", None) or str(exc)
    try:
        res = supabase.table("ai_failures").insert({
            "shop_id": shop_id,
            "photo_url": photo_url,
            "error_message": str(error_message)[:1000],   # 너무 길면 잘라서
            "ai_model": GEMINI_MODEL,                      # 어떤 모델로 시도했는지
        }).execute()
        return res.data[0]["id"] if res.data else None
    except Exception as e:
        logger.error("ai_failures 기록 실패: %s", e)
        return None


# 이 파일의 API 들을 하나로 묶는 라우터.
#   prefix="/api/intake"  → 아래 경로 앞에 자동으로 붙습니다.
#   tags=["intake"]       → 문서(/docs)에서 묶어 보여주기 위한 이름표
router = APIRouter(prefix="/api/intake", tags=["intake"])


# -------------------------------------------------------------------
# 1) POST /api/intake/analyze
#    - 사진 한 장을 받아: 압축 → 저장소 업로드 → AI 인식 → 결과 돌려줌
#    - 아직 DB 에는 저장하지 않습니다. (사장님이 확인/수정 후 confirm 에서 저장)
# -------------------------------------------------------------------
@router.post("/analyze")
async def analyze(
    photo: UploadFile = File(...),                 # 업로드된 사진 파일
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소: 로그인 확인 + shop_id
):
    # (1) 업로드된 사진을 바이트로 읽어옵니다.
    raw_bytes = await photo.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="사진이 비어 있어요. 다시 찍어 주세요.")

    # (2) Pillow 로 압축 (긴 변 1500px + JPEG 85). 이 압축본만 저장/AI 에 씁니다.
    try:
        compressed = compress_image(raw_bytes)
    except Exception as e:
        logger.error("이미지 압축 실패: %s", e)
        raise HTTPException(status_code=400, detail="사진 형식을 처리할 수 없어요. 다른 사진으로 시도해 주세요.")

    # (3) 저장 경로를 만듭니다: {shop_id}/{연도}/{월}/{랜덤이름}.jpg
    #     → 가게별 폴더로 분리되고, 랜덤 이름이라 겹치지 않습니다.
    now = datetime.now()
    filename = f"{uuid.uuid4()}.jpg"
    path = f"{shop.shop_id}/{now.year}/{now.month:02d}/{filename}"

    # (4) 압축본을 Supabase Storage(비공개 버킷)에 업로드합니다.
    try:
        supabase.storage.from_(BUCKET).upload(
            path,
            compressed,
            {"content-type": "image/jpeg"},  # 파일 종류를 JPEG 로 알려줌
        )
    except Exception as e:
        logger.error("사진 업로드 실패: %s", e)
        raise HTTPException(status_code=502, detail="사진 저장에 실패했어요. 잠시 후 다시 시도해 주세요.")

    # (5) 이 가게에 맞는 지시문(프롬프트)을 만들어 Gemini 로 보냅니다.
    #     - ★ [분류 사용자 정의] 프롬프트에 '그 가게가 만든 분류' label 목록을 넣습니다.
    #       분류가 0개면 프롬프트가 분류 추측을 생략합니다.
    #     - ai_raw : Gemini 원본(dict). ai_meta: 모델/시간/토큰 부가정보(사용자엔 안 보임).
    #     - ★ [입고 최종판] AI 인식이 실패해도 사진은 이미 (4)에서 저장됐습니다.
    #       그래서 여기서 502 로 끊지 않고, 실패를 ai_failures 에 남긴 뒤 photo_url·failure_id 를
    #       담아 ai_failed=True 로 돌려줍니다. → 프론트가 [다시 찍기]/[직접 입력] 을 안내합니다.
    shop_categories = fetch_shop_categories(shop.shop_id)   # 활성 분류, 정렬순 (없으면 [])
    prompt = build_extraction_prompt(shop.business_type, shop_categories)
    try:
        ai_raw, ai_meta = analyze_image(compressed, prompt)
    except HTTPException as e:
        # AI 인식만 실패 (사진 저장은 성공). 실패 사진을 ai_failures 에 남기고 failure_id 를 돌려줍니다.
        failure_id = _record_ai_failure(shop.shop_id, path, e)
        return _analyze_response(path, fields={}, ai_raw=None, ai_meta=None,
                                 ai_failed=True, failure_id=failure_id)

    # AI 원본을 '그 업종의 필드만' 남겨 정리(미리채움용). 분류가 그 가게 값이 아니면 None, 숫자는 숫자로.
    fields = clean_ai_fields(shop.business_type, ai_raw, category_values(shop_categories))

    # (6) 프론트(확인 팝업)에 보여줄 값을 돌려줍니다.
    #     - fields : AI 가 읽은 값 (사장님이 이 값을 보고 수정) — 업종 필드에 맞춰 정리됨
    #     - ai_raw : Gemini 원본 (confirm 때 함께 보내 DB 에 보관)
    return _analyze_response(path, fields=fields, ai_raw=ai_raw, ai_meta=ai_meta, ai_failed=False)


# -------------------------------------------------------------------
# 2) POST /api/intake/confirm
#    - 확인 팝업에서 [저장]을 누르면, 확정된 값이 여기로 옵니다.
#    - shop_id 는 프론트가 아니라 검문소에서 얻은 값을 서버가 직접 붙입니다.
# -------------------------------------------------------------------
@router.post("/confirm")
async def confirm(
    body: IntakeConfirm,                           # 확정 데이터 (검증 틀 통과)
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    # ★ [입고 최종판 C] 사진은 반드시 있어야 합니다. (사진 없는 직접 입력은 불가)
    #   photo_url 은 analyze 단계에서 저장된 경로라, 정상/실패 어느 흐름이든 값이 있어야 정상.
    if not body.photo_url or not str(body.photo_url).strip():
        raise HTTPException(status_code=422, detail="사진이 필요합니다.")

    # 입력 fields 를 업종 설정에 맞춰 컬럼값/attributes 로 나눕니다. [Phase 5-A]
    #   - 품목명 필수·분류 허용값 검증도 여기서 이뤄집니다(아니면 422).
    #   - ★ [분류 사용자 정의] 분류 허용값은 그 가게의 shop_categories 에서 가져옵니다.
    allowed_cats = category_values(fetch_shop_categories(shop.shop_id))
    cfg, columns, attributes, flat = _build_intake_payload(shop.business_type, body.fields, allowed_cats)

    # AI 가 읽은 값(ai_raw)과 최종 저장값(flat)을 비교해 '사장님이 고쳤는지'를 판단합니다.
    #   - 프론트가 아니라 여기(백엔드)에서 계산합니다. (프론트 값은 위조될 수 있으니)
    ai_was_edited = _compute_ai_was_edited(shop.business_type, body.ai_raw, flat)

    # DB(intake_records)에 넣을 한 줄을 만듭니다.
    #   - status 는 넣지 않아도 DB 기본값 'in_stock' 이 들어갑니다.
    #   - shop_id 는 검문소의 값으로 강제 (다른 가게로 저장 불가)
    #   - attributes 에는 업종별 추가 필드(brand 등)가 들어갑니다. (gold 는 {})
    row = {
        "shop_id": shop.shop_id,
        **columns,
        "attributes": attributes,
        "photo_url": body.photo_url,
        "ai_raw": body.ai_raw,
        # --- AI 분석 부가정보 (사용자엔 안 보임, 나중에 품질/비용 분석용) ---
        "ai_model": body.ai_model,
        "ai_latency_ms": body.ai_latency_ms,
        "ai_tokens_input": body.ai_tokens_input,
        "ai_tokens_output": body.ai_tokens_output,
        "ai_was_edited": ai_was_edited,   # 위에서 백엔드가 계산한 값
        # ★ [입고 최종판] 인식 경로 표시: 실패 후 직접 입력이면 'failed_manual', 아니면 'success'.
        "ai_status": "failed_manual" if body.failure_id else "success",
    }

    try:
        result = supabase.table("intake_records").insert(row).execute()
    except Exception as e:
        logger.error("입고 저장 실패: %s", e)
        raise HTTPException(status_code=502, detail="저장에 실패했어요. 잠시 후 다시 시도해 주세요.")

    # 저장된 결과(첫 줄)를 돌려줍니다. (프론트에서 성공 확인용)
    saved = result.data[0] if result.data else None

    # ★ [입고 최종판 B-3] 실패 사진에서 이어온 저장이면, 그 실패 기록(ai_failures)을
    #   방금 만든 입고에 연결해 '해결됨'으로 표시합니다. (연결 실패해도 저장은 이미 끝났으니 진행)
    if saved and body.failure_id:
        try:
            (supabase.table("ai_failures")
                .update({"resolved_intake_id": saved["id"]})
                .eq("id", body.failure_id)
                .eq("shop_id", shop.shop_id)   # ★ 남의 가게 실패기록 못 건드리게
                .execute())
        except Exception as e:
            logger.error("실패 기록 연결 실패(failure_id=%s): %s", body.failure_id, e)

    # 새로 만든 기록도 이력에 남깁니다. (action='create')
    #   - before 는 없음(None), after 는 방금 저장된 전체 값.
    #   - 이력 기록이 실패해도 저장 자체는 이미 끝났으니 그대로 진행됩니다(audit.py 참고).
    if saved:
        write_audit_log(
            shop_id=shop.shop_id,
            table_name="intake_records",
            record_id=saved["id"],
            action="create",
            user_id=shop.user_id,
            before_data=None,
            after_data=saved,
        )

    return {"ok": True, "record": saved}


# 한 번에 보여줄 목록 개수 ("더 보기" 20개 단위)
PAGE_SIZE = 20


# -------------------------------------------------------------------
# 3) GET /api/intake/list
#    - 내 가게(shop_id)의 입고 목록을 최신순으로 돌려줍니다.
#    - 검색어·분류·기간으로 걸러내고, 20개씩 끊어서(페이지네이션) 줍니다.
#    - 기본은 정상 기록만(deleted_at 이 비어 있는 것). trash=true 면 삭제된 것만(휴지통).
#    - 사진은 비공개 버킷이라, 잠깐 동안만 볼 수 있는 signed URL 로 만들어 줍니다.
#
#    쿼리 파라미터(모두 선택):
#      q          : 품목명 부분일치 검색어
#      category   : 그 업종에 정의된 분류값 중 하나 (분류 필터)
#      start_date : 시작일 (YYYY-MM-DD, 이 날 0시부터)
#      end_date   : 종료일 (YYYY-MM-DD, 이 날 끝까지 포함)
#      offset     : 몇 번째부터 (0 부터 시작, "더 보기" 누를 때 20씩 증가)
#      trash      : true 면 휴지통(삭제된 것만)
#      status     : in_stock(재고) / sold(판매됨) 로 거를 때 사용 [Phase 2]
#                   (재고 탭은 status=in_stock 을 보냅니다. 없으면 상태 구분 없이 전부)
# -------------------------------------------------------------------
@router.get("/list")
async def list_records(
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    trash: bool = Query(default=False),
    status: str | None = Query(default=None),
):
    try:
        # (1) 내 가게 것만! shop_id 로 거르는 것이 다른 가게 데이터 차단의 핵심.
        query = (
            supabase.table("intake_records")
            .select("id, item_name, category, weight_g, purchase_price, photo_url, created_at, deleted_at, status, attributes")
            .eq("shop_id", shop.shop_id)
        )

        # (2) 휴지통 여부: 기본은 정상(삭제 안 된) 기록만, trash=true 면 삭제된 것만.
        if trash:
            query = query.not_.is_("deleted_at", "null")
        else:
            query = query.is_("deleted_at", "null")

        # (3) 검색어(품목명 부분일치, 대소문자 무시). ilike 의 % 는 "아무 글자나"라는 뜻.
        if q and q.strip():
            query = query.ilike("item_name", f"%{q.strip()}%")

        # (4) 분류 필터 [분류 사용자 정의]
        #     - category 는 그 가게가 만든 분류 value(프론트가 /api/me 에서 받은 값)입니다.
        #     - 위에서 이미 shop_id 로 걸러지므로, 값이 무엇이든 '내 가게' 안에서만 필터됩니다.
        #       (잘못된 값이면 결과가 비는 것뿐, 남의 가게 데이터가 새지 않음) → 별도 화이트리스트 불필요.
        if category:
            query = query.eq("category", category)

        # (4-2) 재고/판매됨 상태 필터 [Phase 2]
        #       - 재고 탭은 status=in_stock 을 보내 아직 안 판 물건만 봅니다.
        if status in ("in_stock", "sold"):
            query = query.eq("status", status)

        # (5) 기간 필터 (created_at 기준)
        #     - 종료일은 그 날 하루를 통째로 포함하려고 " 23:59:59" 를 붙입니다.
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date + " 23:59:59")

        # (6) 최신순 정렬 + 페이지네이션.
        #     - range 는 양끝 포함이라, PAGE_SIZE 보다 1개 더(총 21개) 가져와서
        #       "다음 페이지가 더 있는지(has_more)"를 판단합니다.
        query = query.order("created_at", desc=True).range(offset, offset + PAGE_SIZE)
        result = query.execute()
    except Exception as e:
        logger.error("목록 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail="목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.")

    records = result.data or []

    # 21개가 왔으면 다음 페이지가 더 있다는 뜻. 화면엔 20개만 보내고 신호(has_more)를 켭니다.
    has_more = len(records) > PAGE_SIZE
    if has_more:
        records = records[:PAGE_SIZE]

    # (7) 각 기록의 사진 경로(photo_url)를 잠깐 볼 수 있는 signed URL 로 바꿉니다.
    for rec in records:
        photo_path = rec.get("photo_url")
        rec["photo_signed_url"] = _make_signed_url(photo_path) if photo_path else None

    return {"records": records, "has_more": has_more}


# -------------------------------------------------------------------
# 4) GET /api/intake/{record_id}
#    - 입고 한 건의 '자세한 내용'을 돌려줍니다. (상세 화면용)
#    - 자기 가게(shop_id) 기록만 볼 수 있게 검증합니다. (다른 가게 id 를 넣어도 못 봄)
#    - 사진 signed URL + "수정 이력"(audit_logs)을 함께 담아 줍니다.
#    - 삭제된(휴지통) 기록도 조회는 됩니다. (복구 전에 내용을 확인할 수 있게)
# -------------------------------------------------------------------
@router.get("/{record_id}")
async def get_record(
    record_id: str,
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    # (1) 이 id 이면서 '내 가게' 것인 기록만 찾습니다. (shop_id 로 소유권 검증)
    try:
        result = (
            supabase.table("intake_records")
            .select("*")
            .eq("id", record_id)
            .eq("shop_id", shop.shop_id)   # ★ 남의 가게 기록 접근 차단
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.error("상세 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail="기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.")

    if not result.data:
        # 없거나, 남의 가게 것이거나 → 똑같이 "못 찾음"으로 안내 (존재 여부를 흘리지 않음)
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없어요.")

    rec = result.data[0]

    # (2) 사진을 잠깐 볼 수 있는 signed URL 로 바꿔 넣습니다.
    photo_path = rec.get("photo_url")
    rec["photo_signed_url"] = _make_signed_url(photo_path) if photo_path else None

    # (3) 이 기록의 수정 이력(audit_logs)을 최신순으로 가져옵니다.
    #     - 이력 조회가 실패해도 상세 화면은 떠야 하므로, 실패 시 빈 목록으로 둡니다.
    history = []
    try:
        logs = (
            supabase.table("audit_logs")
            .select("id, action, before_data, after_data, created_at")
            .eq("shop_id", shop.shop_id)
            .eq("table_name", "intake_records")
            .eq("record_id", record_id)
            .order("created_at", desc=True)
            .execute()
        )
        history = logs.data or []
    except Exception as e:
        logger.warning("이력 조회 실패(%s): %s", record_id, e)

    # (4) 판매된(sold) 물건이면, 아직 취소 안 된 판매 기록(outgo)을 함께 담아 줍니다. [Phase 2]
    #     - 상세 화면이 판매가·판매경로·판매일과 [판매 취소] 버튼을 보여주는 데 씁니다.
    #     - 판매정보 조회가 실패해도 상세는 떠야 하므로, 실패 시 sale=None 으로 둡니다.
    sale = None
    if rec.get("status") == "sold":
        try:
            o = (
                supabase.table("outgo_records")
                .select("id, sale_price, channel, memo, created_at")
                .eq("shop_id", shop.shop_id)
                .eq("intake_id", record_id)
                .is_("attributes->>cancelled_at", "null")   # 취소 안 된 판매만
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if o.data:
                od = o.data[0]
                sale = {
                    "outgo_id": od["id"],
                    "sale_price": od.get("sale_price"),
                    "channel": od.get("channel"),
                    "memo": od.get("memo"),
                    "sold_at": od.get("created_at"),
                }
        except Exception as e:
            logger.warning("판매정보 조회 실패(%s): %s", record_id, e)

    return {"record": rec, "history": history, "sale": sale}


# 상세/수정/삭제/복구에서 공통으로 쓰는 도우미:
#   해당 id 이면서 '내 가게' 것인 한 줄을 통째로 가져옵니다.
#   only_alive=True 면 아직 안 지워진 것만, only_deleted=True 면 지워진 것만 찾습니다.
def _fetch_owned_record(record_id: str, shop_id: str, *, only_alive=False, only_deleted=False):
    query = (
        supabase.table("intake_records")
        .select("*")
        .eq("id", record_id)
        .eq("shop_id", shop_id)   # ★ 소유권 검증
    )
    if only_alive:
        query = query.is_("deleted_at", "null")
    if only_deleted:
        query = query.not_.is_("deleted_at", "null")
    result = query.limit(1).execute()
    return result.data[0] if result.data else None


# -------------------------------------------------------------------
# 5) PATCH /api/intake/{record_id}
#    - 입고 한 건의 값을 수정합니다. (상세 화면 → [수정] → 저장)
#    - 저장 시 백엔드가 자동으로: updated_at 갱신 + audit_logs 에 action='update'
#      기록(before=수정 전 전체값, after=수정 후 전체값).
#    - 삭제된(휴지통) 기록은 수정할 수 없습니다. (복구 후에 수정)
# -------------------------------------------------------------------
@router.patch("/{record_id}")
async def update_record(
    record_id: str,
    body: IntakeUpdate,                            # 6개 필드 (품목명 필수)
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    # (1) 수정 전 값을 통째로 확보합니다. (이력의 before_data + 소유권/생존 검증)
    before = _fetch_owned_record(record_id, shop.shop_id, only_alive=True)
    if before is None:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없어요.")

    # (2) 입력 fields 를 업종 설정에 맞춰 컬럼값/attributes 로 나눕니다. [Phase 5-A]
    #     - 품목명 필수·분류 허용값 검증 포함(아니면 422). 분류 허용값은 그 가게 shop_categories.
    #     - attributes 는 통째로 교체됩니다(수정 화면이 그 업종의 추가 필드를 전부 담아 보냄).
    allowed_cats = category_values(fetch_shop_categories(shop.shop_id))
    cfg, columns, attributes, flat = _build_intake_payload(shop.business_type, body.fields, allowed_cats)

    new_fields = {
        **columns,
        "attributes": attributes,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        result = (
            supabase.table("intake_records")
            .update(new_fields)
            .eq("id", record_id)
            .eq("shop_id", shop.shop_id)   # ★ 남의 가게 것 수정 차단
            .execute()
        )
    except Exception as e:
        logger.error("입고 수정 실패: %s", e)
        raise HTTPException(status_code=502, detail="수정에 실패했어요. 잠시 후 다시 시도해 주세요.")

    after = result.data[0] if result.data else None

    # (3) 고친 흔적을 이력에 남깁니다. (action='update', 전/후 전체값)
    if after:
        write_audit_log(
            shop_id=shop.shop_id,
            table_name="intake_records",
            record_id=record_id,
            action="update",
            user_id=shop.user_id,
            before_data=before,
            after_data=after,
        )

    return {"ok": True, "record": after}


# -------------------------------------------------------------------
# 6) DELETE /api/intake/{record_id}
#    - 실제로 지우지 않습니다! deleted_at 에 '지금 시각'만 적어 휴지통으로 보냅니다(소프트 삭제).
#    - audit_logs 에 action='delete' 기록. (before=지우기 전 값)
#    - 이미 삭제된 것은 다시 삭제하지 않습니다.
# -------------------------------------------------------------------
@router.delete("/{record_id}")
async def delete_record(
    record_id: str,
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    # (1) 아직 살아있는(안 지워진) 내 가게 기록만 대상으로.
    before = _fetch_owned_record(record_id, shop.shop_id, only_alive=True)
    if before is None:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없어요.")

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        result = (
            supabase.table("intake_records")
            .update({"deleted_at": now_iso})
            .eq("id", record_id)
            .eq("shop_id", shop.shop_id)
            .execute()
        )
    except Exception as e:
        logger.error("입고 삭제 실패: %s", e)
        raise HTTPException(status_code=502, detail="삭제에 실패했어요. 잠시 후 다시 시도해 주세요.")

    after = result.data[0] if result.data else None

    # (2) 삭제 이력 남기기. (실제 데이터는 휴지통에 그대로 있음)
    write_audit_log(
        shop_id=shop.shop_id,
        table_name="intake_records",
        record_id=record_id,
        action="delete",
        user_id=shop.user_id,
        before_data=before,
        after_data=after,
    )

    return {"ok": True}


# -------------------------------------------------------------------
# 7) POST /api/intake/{record_id}/restore
#    - 휴지통에 있는 기록을 되살립니다. deleted_at 을 다시 비웁니다(null).
#    - audit_logs 에 action='restore' 기록.
#    - 삭제된 상태인 것만 복구할 수 있습니다.
# -------------------------------------------------------------------
@router.post("/{record_id}/restore")
async def restore_record(
    record_id: str,
    shop: ShopContext = Depends(CurrentShop),      # ★ 검문소
):
    # (1) 삭제된 상태인 내 가게 기록만 대상으로.
    before = _fetch_owned_record(record_id, shop.shop_id, only_deleted=True)
    if before is None:
        raise HTTPException(status_code=404, detail="복구할 기록을 찾을 수 없어요.")

    try:
        result = (
            supabase.table("intake_records")
            .update({"deleted_at": None})   # 휴지통에서 꺼냄
            .eq("id", record_id)
            .eq("shop_id", shop.shop_id)
            .execute()
        )
    except Exception as e:
        logger.error("입고 복구 실패: %s", e)
        raise HTTPException(status_code=502, detail="복구에 실패했어요. 잠시 후 다시 시도해 주세요.")

    after = result.data[0] if result.data else None

    # (2) 복구 이력 남기기.
    write_audit_log(
        shop_id=shop.shop_id,
        table_name="intake_records",
        record_id=record_id,
        action="restore",
        user_id=shop.user_id,
        before_data=before,
        after_data=after,
    )

    return {"ok": True}


def _make_signed_url(path: str) -> str | None:
    """
    비공개 버킷의 사진 경로를 1시간 동안 유효한 signed URL 로 만들어 돌려줍니다.
    실패하면 None (사진만 안 보이고, 목록 자체는 정상 표시되게).
    """
    try:
        # 3600초 = 1시간 동안 유효
        signed = supabase.storage.from_(BUCKET).create_signed_url(path, 3600)
        # supabase 버전에 따라 키 이름이 다를 수 있어 두 가지를 모두 확인합니다.
        return signed.get("signedURL") or signed.get("signedUrl")
    except Exception as e:
        logger.warning("signed URL 생성 실패(%s): %s", path, e)
        return None
