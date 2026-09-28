# ===================================================================
# field_config.py  —  "업종별 설정 사전 (하드코딩을 여기 한 곳으로)"  [Phase 5-A]
# -------------------------------------------------------------------
# 이 파일이 하는 일 (아주 중요):
#   - 지금까지 금은방(gold) 전용으로 코드 여기저기에 흩어져 있던
#     분류(금/은/기타), 입력 필드(중량·순도 등), Gemini 프롬프트를
#     '업종(business_type)별 설정' 한 곳에 모읍니다.
#   - 새 업종을 추가하려면? 아래 BUSINESS_CONFIGS 에 설정 한 덩어리만 추가하면 됩니다.
#     (백엔드/프론트 로직 코드는 거의 손대지 않아도 됨)
#
# 저장 위치 규칙 (컬럼 vs attributes):
#   - intake_records 에 '진짜 컬럼'으로 있는 필드: item_name, category,
#     weight_g, purity, purchase_price, memo  → 그 컬럼에 저장.
#   - 그 밖의 업종별 추가 필드(예: 브랜드/모델명/상태등급)는 컬럼이 없으므로
#     attributes(jsonb)에 {"brand": ...} 처럼 저장.
#   - 어디에 저장할지는 아래 INTAKE_COLUMN_KEYS 로 '자동 판별'합니다.
#     (설정 작성자는 필드만 나열하면 되고, 저장 위치는 신경 안 써도 됨)
# ===================================================================


# intake_records 에 실제로 존재하는 '입력 컬럼'들.
#   - 필드의 key 가 여기 있으면 그 컬럼에 저장, 없으면 attributes 에 저장합니다.
INTAKE_COLUMN_KEYS = {
    "item_name", "category", "weight_g", "purity", "purchase_price", "memo",
    "short_code",   # [코드 판매] 품목 코드 — 실제 컬럼(intake_records.short_code)
}

# 업종을 못 찾을 때 기본으로 쓸 업종 (안전장치)
DEFAULT_BUSINESS_TYPE = "gold"


# -------------------------------------------------------------------
# 모든 업종 공통 필드 (업종 설정과 별개로 항상 들어감)  [코드 판매]
#   - short_code(품목 코드): 입고 때 AI 가 사진에서 읽어 저장하고,
#     판매 때 이 코드로 재고를 찾습니다. 한 코드에 여러 재고가 있을 수 있습니다.
#   - 품목명(item_name) 바로 뒤에 끼워 넣습니다. (business_fields 참고)
# -------------------------------------------------------------------
UNIVERSAL_FIELDS = [
    {"key": "short_code", "label": "품목 코드", "type": "text",
     "ai_hint": "물건이나 가격표에 적힌 짧은 품목 코드(번호·기호). 여러 물건이 같은 코드일 수 있어요. 없으면 null"},
]


# -------------------------------------------------------------------
# 업종별 설정 사전
#   각 업종은 이렇게 구성됩니다:
#     label        : 화면에 보일 업종 이름
#     categories   : 분류 선택지 [{value, label, color(배경), text(글자색)}]
#     fields       : 입력 필드 목록 [{key, label, type, ai_hint, options?}]
#                    type: "text" 글자 / "number" 숫자 / "select" 선택
#     card_fields  : 목록 카드에 강조해 보여줄 필드 key 들 (매입가는 별도로 항상 표시)
#     prompt_intro : Gemini 에게 줄 '무슨 사진인지' 도입 문장
# -------------------------------------------------------------------
BUSINESS_CONFIGS = {
    # ============================ 금은방 ============================
    "gold": {
        "label": "금은방",
        "categories": [
            {"value": "gold",   "label": "금",   "color": "#c9a227", "text": "#2a2100"},
            {"value": "silver", "label": "은",   "color": "#8a8f98", "text": "#ffffff"},
            {"value": "other",  "label": "기타", "color": "#3b6bb0", "text": "#ffffff"},
        ],
        "fields": [
            {"key": "item_name",      "label": "품목명",     "type": "text",
             "ai_hint": "물건의 이름 (예: 반지, 목걸이, 순금 골드바 등)"},
            {"key": "category",       "label": "분류",       "type": "select",
             "ai_hint": "재질에 따라 gold(금), silver(은), other(기타) 중 하나로 판단"},
            {"key": "weight_g",       "label": "중량(g)",    "type": "number",
             "ai_hint": "무게를 그램(g) 단위 숫자로. 예: 3.75 (단위 글자는 빼고 숫자만)"},
            {"key": "purity",         "label": "순도",       "type": "text",
             "ai_hint": "순도 표기 그대로. 예: 24K, 18K, 925 등"},
            {"key": "purchase_price", "label": "매입가(원)", "type": "number",
             "ai_hint": "사진에 매입 금액이 적혀 있을 때만 원(KRW) 단위 숫자로. 없으면 null"},
            {"key": "memo",           "label": "메모",       "type": "text",
             "ai_hint": "그 밖의 손글씨 메모나 특이사항"},
        ],
        "card_fields": ["weight_g"],
        "prompt_intro": "당신은 금은방(귀금속) 물건 사진에서 정보를 읽어내는 도우미입니다.",
    },

    # ======================= 중고명품 (검증용) =======================
    "luxury": {
        "label": "중고명품",
        "categories": [
            {"value": "bag",     "label": "가방",   "color": "#b5651d", "text": "#ffffff"},
            {"value": "watch",   "label": "시계",   "color": "#2c7a7b", "text": "#ffffff"},
            {"value": "jewelry", "label": "쥬얼리", "color": "#9b2c6f", "text": "#ffffff"},
            {"value": "other",   "label": "기타",   "color": "#3b6bb0", "text": "#ffffff"},
        ],
        "fields": [
            {"key": "item_name",      "label": "품목명",     "type": "text",
             "ai_hint": "물건의 이름 (예: 클래식 플랩백, 데이토나 등)"},
            {"key": "category",       "label": "분류",       "type": "select",
             "ai_hint": "종류에 따라 bag(가방), watch(시계), jewelry(쥬얼리), other(기타) 중 하나"},
            {"key": "brand",          "label": "브랜드",     "type": "text",
             "ai_hint": "제조 브랜드 (예: 샤넬, 롤렉스, 까르띠에). 태그/보증서에서 읽기"},
            {"key": "model",          "label": "모델명",     "type": "text",
             "ai_hint": "모델명이나 레퍼런스 번호 (예: A01112, 116500LN)"},
            {"key": "grade",          "label": "상태등급",   "type": "select",
             "ai_hint": "겉보기 상태 등급을 A/B/C 중 하나로 (A 최상, C 사용감 많음). 모르면 null",
             "options": [
                 {"value": "A", "label": "A (최상)"},
                 {"value": "B", "label": "B (양호)"},
                 {"value": "C", "label": "C (사용감)"},
             ]},
            {"key": "purchase_price", "label": "매입가(원)", "type": "number",
             "ai_hint": "사진에 매입 금액이 적혀 있을 때만 원(KRW) 단위 숫자로. 없으면 null"},
            {"key": "memo",           "label": "메모",       "type": "text",
             "ai_hint": "구성품(더스트백/보증서 유무)이나 그 밖의 특이사항"},
        ],
        "card_fields": ["brand", "grade"],
        "prompt_intro": "당신은 중고명품(가방·시계·쥬얼리) 매입 태그나 보증서 사진에서 정보를 읽어내는 도우미입니다.",
    },

    # ============================== 시계 ==============================
    "watch": {
        "label": "시계",
        "categories": [
            {"value": "mechanical", "label": "기계식", "color": "#5a4632", "text": "#ffffff"},
            {"value": "quartz",     "label": "쿼츠",   "color": "#2c7a7b", "text": "#ffffff"},
            {"value": "smart",      "label": "스마트", "color": "#3b6bb0", "text": "#ffffff"},
            {"value": "other",      "label": "기타",   "color": "#8a8f98", "text": "#ffffff"},
        ],
        "fields": [
            {"key": "item_name",      "label": "품목명",     "type": "text",
             "ai_hint": "시계의 이름 (예: 서브마리너, 스피드마스터 등)"},
            {"key": "category",       "label": "분류",       "type": "select",
             "ai_hint": "구동 방식에 따라 mechanical(기계식), quartz(쿼츠), smart(스마트워치), other(기타) 중 하나"},
            {"key": "brand",          "label": "브랜드",     "type": "text",
             "ai_hint": "제조 브랜드 (예: 롤렉스, 오메가, 세이코). 다이얼/보증서에서 읽기"},
            {"key": "model",          "label": "모델명",     "type": "text",
             "ai_hint": "모델명이나 레퍼런스 번호 (예: 116610LN)"},
            {"key": "serial",         "label": "시리얼",     "type": "text",
             "ai_hint": "케이스백이나 보증서에 적힌 시리얼(고유번호). 없으면 null"},
            {"key": "grade",          "label": "상태등급",   "type": "select",
             "ai_hint": "겉보기 상태 등급을 A/B/C 중 하나로 (A 최상, C 사용감 많음). 모르면 null",
             "options": [
                 {"value": "A", "label": "A (최상)"},
                 {"value": "B", "label": "B (양호)"},
                 {"value": "C", "label": "C (사용감)"},
             ]},
            {"key": "purchase_price", "label": "매입가(원)", "type": "number",
             "ai_hint": "사진에 매입 금액이 적혀 있을 때만 원(KRW) 단위 숫자로. 없으면 null"},
            {"key": "memo",           "label": "메모",       "type": "text",
             "ai_hint": "구성품(박스/보증서 유무)이나 그 밖의 특이사항"},
        ],
        "card_fields": ["brand", "grade"],
        "prompt_intro": "당신은 시계 매입 태그나 보증서·다이얼 사진에서 정보를 읽어내는 도우미입니다.",
    },

    # ============================= 중고폰 =============================
    "phone": {
        "label": "중고폰",
        "categories": [
            {"value": "smartphone", "label": "스마트폰", "color": "#2c7a7b", "text": "#ffffff"},
            {"value": "tablet",     "label": "태블릿",   "color": "#3b6bb0", "text": "#ffffff"},
            {"value": "other",      "label": "기타",     "color": "#8a8f98", "text": "#ffffff"},
        ],
        "fields": [
            {"key": "item_name",      "label": "품목명",     "type": "text",
             "ai_hint": "기기의 이름 (예: 갤럭시 S24, 아이폰 15 등)"},
            {"key": "category",       "label": "분류",       "type": "select",
             "ai_hint": "종류에 따라 smartphone(스마트폰), tablet(태블릿), other(기타) 중 하나"},
            {"key": "manufacturer",   "label": "제조사",     "type": "text",
             "ai_hint": "제조사 (예: 삼성, 애플, LG)"},
            {"key": "model",          "label": "모델",       "type": "text",
             "ai_hint": "모델명이나 모델 번호 (예: SM-S921N, A3092)"},
            {"key": "capacity",       "label": "용량",       "type": "text",
             "ai_hint": "저장 용량 표기 그대로 (예: 256GB). 없으면 null"},
            {"key": "grade",          "label": "상태등급",   "type": "select",
             "ai_hint": "겉보기 상태 등급을 A/B/C 중 하나로 (A 최상, C 사용감 많음). 모르면 null",
             "options": [
                 {"value": "A", "label": "A (최상)"},
                 {"value": "B", "label": "B (양호)"},
                 {"value": "C", "label": "C (사용감)"},
             ]},
            {"key": "purchase_price", "label": "매입가(원)", "type": "number",
             "ai_hint": "사진에 매입 금액이 적혀 있을 때만 원(KRW) 단위 숫자로. 없으면 null"},
            {"key": "memo",           "label": "메모",       "type": "text",
             "ai_hint": "구성품(박스/충전기 유무)이나 그 밖의 특이사항"},
        ],
        "card_fields": ["manufacturer", "grade"],
        "prompt_intro": "당신은 중고 휴대폰·태블릿의 매입 태그나 기기 정보 화면 사진에서 정보를 읽어내는 도우미입니다.",
    },

    # ===================== 일반 (어디에도 안 맞을 때의 기본) =====================
    "general": {
        "label": "일반",
        "categories": [
            {"value": "general", "label": "일반", "color": "#3b6bb0", "text": "#ffffff"},
        ],
        "fields": [
            {"key": "item_name",      "label": "품목명",     "type": "text",
             "ai_hint": "물건의 이름"},
            {"key": "category",       "label": "분류",       "type": "select",
             "ai_hint": "분류는 general(일반) 하나뿐입니다. 항상 general 로 판단하세요."},
            {"key": "purchase_price", "label": "매입가(원)", "type": "number",
             "ai_hint": "사진에 매입 금액이 적혀 있을 때만 원(KRW) 단위 숫자로. 없으면 null"},
            {"key": "memo",           "label": "메모",       "type": "text",
             "ai_hint": "그 밖의 손글씨 메모나 특이사항"},
        ],
        "card_fields": [],
        "prompt_intro": "당신은 매입 물건 사진이나 태그에서 정보를 읽어내는 도우미입니다.",
    },
}


# -------------------------------------------------------------------
# 설정을 꺼내 쓰는 도우미들
# -------------------------------------------------------------------
def get_business_config(business_type: str | None) -> dict:
    """
    업종 코드로 설정을 돌려줍니다. 모르는 업종이면 기본(gold)으로 대체합니다.
    (발급 때 업종이 고정되므로 보통은 정확히 들어오지만, 안전장치를 둡니다.)
    """
    if business_type and business_type in BUSINESS_CONFIGS:
        return BUSINESS_CONFIGS[business_type]
    return BUSINESS_CONFIGS[DEFAULT_BUSINESS_TYPE]


def business_fields(business_type: str | None) -> list[dict]:
    """
    그 업종의 '입력 필드 전체' = 업종 필드 + 모든 업종 공통 필드(short_code). [코드 판매]
      - 순서: 품목명(item_name) → 품목 코드(short_code) → 나머지 업종 필드.
      - 프롬프트/확인 폼/상세/검증이 모두 이 목록을 기준으로 돕니다.
    """
    base = list(get_business_config(business_type)["fields"])
    out = []
    inserted = False
    for f in base:
        out.append(f)
        if f["key"] == "item_name" and not inserted:
            out.extend(UNIVERSAL_FIELDS)   # 품목명 바로 뒤에 공통 필드
            inserted = True
    if not inserted:                        # 이론상 item_name 이 없을 때: 맨 앞에
        out = list(UNIVERSAL_FIELDS) + out
    return out


def category_values(categories) -> list[str]:
    """
    분류 목록에서 value 들만 뽑습니다. [분류 사용자 정의]
      - categories 는 '그 가게가 만든 분류'(shop_categories) 목록입니다.
        각 원소는 최소한 {"value": ...} 를 가진 dict 여야 합니다.
      - 예전엔 업종(BUSINESS_CONFIGS)에서 뽑았지만, 이제 분류는 가게가 직접 만든 것에서만 옵니다.
    """
    return [c["value"] for c in (categories or [])]


def field_store(key: str) -> str:
    """이 필드를 어디에 저장하는지: 진짜 컬럼이면 'column', 아니면 'attributes'."""
    return "column" if key in INTAKE_COLUMN_KEYS else "attributes"


def compare_fields(business_type: str | None) -> list[tuple[str, bool]]:
    """
    ai_was_edited 계산용: 비교할 (필드key, 숫자필드인가?) 목록.
    (업종 설정의 필드에서 자동으로 만듭니다.)
    """
    return [(f["key"], f["type"] == "number") for f in business_fields(business_type)]


def public_config(business_type: str | None, categories) -> dict:
    """
    프론트에 내려줄 '공개용' 설정. (Gemini 프롬프트/ai_hint 같은 내부 정보는 뺌)
      - 프론트는 이 값으로 분류 버튼/드롭다운/입력 필드/뱃지색/카드표시를 그립니다.
      - 각 필드에 store(column/attributes)를 넣어, 프론트가 값을 어디서 읽을지 알게 합니다.
      - ★ [분류 사용자 정의] categories 는 '그 가게가 만든 분류'(shop_categories)에서 옵니다.
        업종(BUSINESS_CONFIGS)은 이제 fields/card_fields/프롬프트도입부만 담당합니다.
        분류가 0개인 새 가게는 categories 가 빈 리스트로 내려갑니다.
    """
    cfg = get_business_config(business_type)
    fields = []
    for f in business_fields(business_type):   # 업종 필드 + 공통(short_code)
        item = {
            "key": f["key"],
            "label": f["label"],
            "type": f["type"],
            "store": field_store(f["key"]),
        }
        if "options" in f:
            item["options"] = f["options"]
        fields.append(item)
    return {
        "label": cfg["label"],
        "categories": categories or [],   # 가게가 만든 분류 (없으면 빈 리스트)
        "fields": fields,
        "card_fields": cfg.get("card_fields", []),
    }


def clean_ai_fields(business_type: str | None, data, allowed_category_values) -> dict:
    """
    Gemini 가 준 원본(dict)을, 그 업종에 '정의된 필드만' 남기고 살짝 다듬습니다.
      - 정의에 없는 엉뚱한 키는 버립니다.
      - 분류(category)가 그 가게의 허용값이 아니면 None 으로 (사장님이 직접 고르게).
        · allowed_category_values : 그 가게 분류 value 목록 (shop_categories 기준). 0개면 항상 None.
      - 숫자 필드는 숫자로 바꿔 봅니다(안 되면 None).
    프론트 확인 팝업의 '미리 채움' 값으로 씁니다.
    """
    if not isinstance(data, dict):
        data = {}
    allowed_categories = set(allowed_category_values or [])

    cleaned = {}
    for f in business_fields(business_type):   # 업종 필드 + 공통(short_code)
        key = f["key"]
        value = data.get(key)

        if key == "category":
            cleaned[key] = value if value in allowed_categories else None
            continue

        if f["type"] == "number" and value is not None:
            cleaned[key] = _to_number(value)
            continue

        cleaned[key] = value
    return cleaned


def _to_number(value):
    """'18.75' 같은 문자열/숫자를 숫자로. 소수점 있으면 float, 없으면 int. 안 되면 None."""
    try:
        text = str(value).strip().replace(",", "")
        if text == "":
            return None
        if "." in text:
            return float(text)
        return int(text)
    except (TypeError, ValueError):
        return None


# -------------------------------------------------------------------
# Gemini 프롬프트 자동 생성 (업종별)
# -------------------------------------------------------------------
def build_extraction_prompt(business_type: str | None, categories) -> str:
    """
    그 업종의 필드 정의 + '그 가게의 분류(categories)'로부터 Gemini 지시문을 만듭니다.
    [분류 사용자 정의]
      - 분류(category)는 BUSINESS_CONFIGS 고정값이 아니라, 가게가 만든 분류에서 옵니다.
        · 분류가 있으면: label 목록을 프롬프트에 동적으로 넣어 "이 중 택1, 없으면 null".
        · 분류가 0개면: category 항목 자체를 프롬프트에서 빼서 '분류 추측을 생략'합니다.
      - categories 각 원소는 {"value","label"} 를 가진 dict.
    """
    cfg = get_business_config(business_type)
    cat_list = categories or []
    fields = business_fields(business_type)   # 업종 필드 + 공통(short_code)

    # (1) 각 필드 설명 줄. category 는 가게 분류에 맞춰 '동적으로' 처리합니다.
    lines = []
    for f in fields:
        if f["key"] == "category":
            if cat_list:
                opts = ", ".join(f'{c["value"]}({c["label"]})' for c in cat_list)
                lines.append(f'- category (분류): 아래 선택지 중 하나로. 해당 없으면 null. [선택지: {opts}]')
            # 분류가 0개면 이 줄을 아예 넣지 않음 → AI 가 분류를 추측하지 않음
            continue
        lines.append(f'- {f["key"]} ({f["label"]}): {f["ai_hint"]}')
    field_lines = "\n".join(lines)

    # (2) 결과 JSON 뼈대 (모든 값 null 예시) — category 키는 뼈대엔 그대로 두되,
    #     분류가 없으면 위에서 설명을 안 했으므로 AI 는 null 로 둡니다.
    json_skeleton = "{\n" + ",\n".join(f'  "{f["key"]}": null' for f in fields) + "\n}"

    # (3) 분류 허용값 규칙 줄 (분류가 있을 때만)
    cat_rule = ""
    if cat_list:
        cats = ", ".join(f'"{c["value"]}"' for c in cat_list)
        cat_rule = f"\n- category 값은 반드시 {cats} 중 하나이거나 null 이어야 합니다."

    prompt = f"""{cfg["prompt_intro"]}
아래 사진을 보고, 각 항목을 읽어 JSON 하나로만 답하세요.

[읽어야 할 항목]
{field_lines}

[규칙]
- 반드시 아래 형태의 JSON "하나만" 출력하세요.
- 마크다운 코드블록(```)이나 설명 문장을 절대 붙이지 마세요. JSON 만 출력합니다.
- 사진에서 읽을 수 없는 항목의 값은 null 로 두세요.{cat_rule}
- 숫자 항목은 따옴표 없는 숫자로, 단위 글자는 빼세요.

[출력할 JSON 형식]
{json_skeleton}
"""
    return prompt


# -------------------------------------------------------------------
# 판매용: 사진에서 '품목 코드'만 읽는 짧은 프롬프트  [코드 판매 2단계]
#   - 판매할 때는 다른 정보는 필요 없고, 그 물건의 코드만 알면 재고를 찾을 수 있습니다.
# -------------------------------------------------------------------
def build_code_prompt() -> str:
    return (
        "이 사진에서 물건이나 가격표에 적힌 '품목 코드'(짧은 번호나 기호)를 읽으세요.\n"
        "- 반드시 아래 JSON '하나만' 출력하세요. 마크다운/설명은 붙이지 마세요.\n"
        '- 코드를 읽을 수 없으면 short_code 를 null 로 두세요.\n'
        "[출력할 JSON 형식]\n"
        '{\n  "short_code": null\n}'
    )


# -------------------------------------------------------------------
# 판매 경로(channel) 선택지  [Phase 2: 출고]  — 업종과 무관하게 공통
# -------------------------------------------------------------------
OUTGO_CHANNEL_OPTIONS = [
    {"value": "store", "label": "매장"},
    {"value": "phone", "label": "전화"},
    {"value": "other", "label": "기타"},
]
OUTGO_CHANNEL_VALUES = [opt["value"] for opt in OUTGO_CHANNEL_OPTIONS]


# -------------------------------------------------------------------
# 하위호환 별칭 (예전 코드가 참조하던 gold 기본값)
#   - 새 코드는 위의 업종별 함수를 쓰세요. 이건 옛 import 가 안 깨지게 두는 것.
# -------------------------------------------------------------------
CATEGORY_OPTIONS = [
    {"value": c["value"], "label": c["label"]}
    for c in BUSINESS_CONFIGS["gold"]["categories"]
]
CATEGORY_VALUES = [c["value"] for c in BUSINESS_CONFIGS["gold"]["categories"]]
