# ===================================================================
# gemini.py  —  "사진을 AI(Gemini)에게 보내 글자를 읽어오는 일꾼"
# -------------------------------------------------------------------
# 흐름:
#   1) 압축된 사진 + 지시문(프롬프트)을 Gemini 에게 보냄
#   2) Gemini 가 JSON 글자를 돌려줌
#   3) 그 글자를 진짜 JSON(파이썬 딕셔너리)으로 바꿈(파싱)
#   4) 실패하면 1번 더 시도 (총 2번)
#   5) 그래도 실패하면 한국어 에러
#   6) 성공하면 원본 JSON(dict)을 그대로 돌려줌
#      (필드 정리·검증은 업종을 아는 라우터가 clean_ai_fields 로 합니다) [Phase 5-A]
#
# ※ 사용하는 라이브러리는 최신 SDK 인 'google-genai' 입니다.
#   (구버전 google-generativeai 아님)
# ===================================================================

import json           # 글자 <-> JSON 변환 도구
import time           # AI 응답에 걸린 시간(밀리초)을 재기 위한 도구
import logging        # 개발자용 오류 기록(로그) 도구

from fastapi import HTTPException
from google import genai                 # 최신 Gemini SDK
from google.genai import types           # 사진 데이터를 담을 때 사용

from backend.config import settings
# ※ [Phase 5-A] 프롬프트는 업종마다 다르므로, 이 파일 안에서 만들지 않고
#   호출하는 쪽(analyze)이 만들어서 넘겨줍니다. 결과 검증/정리도 업종을 아는
#   라우터에서 하므로, 여기서는 원본 JSON(dict)만 돌려줍니다.


# 개발자용 로그 기록기 (사용자 화면이 아니라 서버 콘솔/로그로 나갑니다)
logger = logging.getLogger("gemini")

# 사용할 Gemini 모델 이름 (flash 계열 안정 버전)
GEMINI_MODEL = "gemini-2.5-flash"

# Gemini 리모컨(클라이언트)을 하나 만들어 둡니다.
client = genai.Client(api_key=settings.GEMINI_API_KEY)


def _clean_json_text(text: str) -> str:
    """
    Gemini 가 실수로 ```json ... ``` 같은 마크다운 백틱을 붙여 보낼 때를 대비해,
    그 껍데기를 벗겨 순수 JSON 글자만 남깁니다. (안전용 청소기)
    """
    cleaned = text.strip()
    # 앞에 붙은 ``` 또는 ```json 제거
    if cleaned.startswith("```"):
        # 첫 줄(``` 또는 ```json)을 통째로 떼어냄
        cleaned = cleaned.split("\n", 1)[-1]
    # 끝에 붙은 ``` 제거
    if cleaned.endswith("```"):
        cleaned = cleaned[: -3]
    return cleaned.strip()


def analyze_image(image_bytes: bytes, prompt: str) -> tuple[dict, dict]:
    """
    압축된 사진 바이트 + 지시문(prompt)을 받아 Gemini 로 분석합니다.
      - prompt 는 호출하는 쪽(라우터)이 '그 가게 업종'에 맞게 만들어 넘깁니다.

    돌려주는 값 (2개 묶음):
      - dict (data)  : Gemini 가 준 원본 JSON (DB의 ai_raw 에 그대로 보관 + 정리해 미리채움)
      - dict (meta)  : AI 분석 부가정보 — 사용자에겐 안 보이고, 나중에 품질 분석용.
                       { ai_model, ai_latency_ms, ai_tokens_input, ai_tokens_output }
                       측정 못 한 값은 None(=null) 로 둡니다. (에러 내지 않음)

    실패 시 HTTPException(한국어 메시지)을 냅니다.
    """

    # 사진을 Gemini 가 이해하는 형태(Part)로 감쌉니다. (JPEG 이미지)
    image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")

    last_error: Exception | None = None  # 마지막 실패 원인을 기억해 둠(로그용)

    # 최대 2번 시도 (첫 시도 + 실패 시 재시도 1번)
    for attempt in range(1, 3):
        try:
            # (1) Gemini 에게 사진 + 지시문을 보냄
            #     - 호출 '직전' 시간을 재두고, 응답을 받은 '직후' 시간과의 차이로
            #       걸린 시간(ms)을 계산합니다. perf_counter 는 시간 측정 전용 시계예요.
            start = time.perf_counter()
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[image_part, prompt],
            )
            latency_ms = int((time.perf_counter() - start) * 1000)

            # (1-b) 토큰 사용량을 응답에서 꺼냅니다. (품질/비용 분석용, 사용자엔 안 보임)
            #       - SDK 버전이나 응답에 따라 usage_metadata 가 없을 수도 있으니
            #         getattr 로 안전하게 꺼내고, 없으면 그냥 None(=null) 로 둡니다.
            usage = getattr(response, "usage_metadata", None)
            meta = {
                "ai_model": GEMINI_MODEL,   # 실제 호출에 쓴 모델명
                "ai_latency_ms": latency_ms,
                "ai_tokens_input": getattr(usage, "prompt_token_count", None) if usage else None,
                "ai_tokens_output": getattr(usage, "candidates_token_count", None) if usage else None,
            }

            # (2) 응답 글자를 꺼내 백틱 껍데기를 청소
            raw_text = response.text or ""
            cleaned = _clean_json_text(raw_text)

            # (3) 글자 → JSON(딕셔너리) 으로 변환
            data = json.loads(cleaned)
            if not isinstance(data, dict):
                # 혹시 리스트/숫자 등 딕셔너리가 아니면 다시 시도하게 함
                raise ValueError("JSON 최상위가 객체가 아님")

            # 성공! 원본(dict) + 부가정보(meta) 를 함께 돌려줍니다.
            #   (필드 정리/검증은 업종을 아는 라우터에서 clean_ai_fields 로 합니다.)
            return data, meta

        except Exception as e:
            # 실패하면 원인을 기록하고, 다음 시도로 넘어감
            last_error = e
            logger.warning("Gemini 분석 실패 (시도 %d/2): %s", attempt, e)

    # (5) 2번 다 실패한 경우 → 개발자 로그 남기고, 사용자에겐 한국어 안내
    logger.error("Gemini 분석 최종 실패: %s", last_error)
    raise HTTPException(
        status_code=502,
        detail="사진을 읽지 못했어요. 더 밝은 곳에서 다시 찍어 주세요.",
    )
