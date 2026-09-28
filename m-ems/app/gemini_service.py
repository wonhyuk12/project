"""Gemini(google-genai) 연동: 집계 데이터를 근거로 한 M-EMS 전기 사용 전략 리포트 생성."""

import json

from google import genai

from .config import GEMINI_API_KEY, GEMINI_MODEL

_client: genai.Client | None = None


class GeminiNotConfiguredError(RuntimeError):
    pass


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise GeminiNotConfiguredError(
                "GEMINI_API_KEY가 설정되지 않았습니다. m-ems/.env 파일에 키를 넣어주세요."
            )
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def generate_text(prompt: str) -> str:
    client = _get_client()
    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return response.text


_SYSTEM_CONTEXT = """\
당신은 충청남도 서해안(보령·태안) 수산업 소상공인을 위한 에너지 관리 서비스
'M-EMS(MINI ENERGY MANAGEMENT SYSTEM)'의 에너지 컨설턴트 겸 IR 피치덱 자문위원입니다.

[M-EMS 서비스 개요]
- 대상: 활어수조·냉동고·제빙기 등 상시 가동 설비를 운영하는 보령·태안 수산업 소상공인
  (월 전기요금 50만 원 이상, 설비 고장 시 100만 원 이상 손실 위험군이 핵심 타겟)
- 핵심 가치: 설비를 강제로 끄지 않고, 같은 성능을 내기 위해 불필요하게 늘어난 전력
  (응축기 오염, 냉매 부족, 문 미폐쇄, 필터 오염 등으로 인한 압축기 과잉 가동)을 찾아낸다.
- 요금제: Basic(모니터링·월간 리포트), Standard(실시간 알림·이상징후 탐지·원격 제어),
  Premium(예지정비·신선도 인증·보험/금융 연계)
- 비교 벤치마크: 경기도 '소규모시설 에너지관리시스템 설치 지원사업'은 스마트플러그+온습도센서로
  전력 사용량 6.2%, 전기요금 4.7% 절감을 실증함(전통시장 소규모 점포 대상, 상시가동 설비는 미포함).
  M-EMS의 차별점은 "꺼도 되는 전기"가 아니라 "끌 수 없는 설비"의 과잉 가동을 관리한다는 것.
"""


def build_market_strategy_prompt(
    scope_desc: str,
    market_overview: dict,
    monthly_summary: dict,
    savings_scenario: dict,
    revenue_scenario: list[dict] | None = None,
) -> str:
    data_block = json.dumps(
        {
            "분석범위": scope_desc,
            "시장개요": market_overview,
            "월별_계절패턴": monthly_summary,
            "절감_시뮬레이션": savings_scenario,
            "구독매출_시뮬레이션": revenue_scenario or [],
        },
        ensure_ascii=False,
        indent=2,
        default=str,
    )

    return f"""{_SYSTEM_CONTEXT}

아래는 '보령시 수산업 전기 사용량·요금 예측 데이터'를 업종별/월별로 집계한 결과입니다.
이 수치는 지자체·에너지공단 통계를 바탕으로 만든 추정 모델값이며, 연도별로 동일한
계절 패턴이 반복됩니다 (실제 스마트미터 실측 데이터가 아니라 사업계획 검증용 추정치).

```json
{data_block}
```

위 데이터를 근거로, IR 피치덱(사업계획서)과 발표 Q&A에 바로 쓸 수 있도록
아래 형식의 한국어 전략 리포트를 작성해 주세요. 숫자는 반드시 위 데이터에 있는
값을 인용하고, 데이터에 없는 수치는 임의로 만들지 마세요(추정이 필요하면
"추정" 또는 "가정"이라고 명시).

## 1. 업종별 공략 우선순위
- 총 전기요금 비중이 큰 업종부터 순서대로, 왜 그 업종을 먼저 공략해야 하는지
  데이터 근거와 함께 3~5개 서술

## 2. 계절별 절감 전략
- 성수기(피크월)와 비수기(off-peak월)를 구분하고, 각 시기에 M-EMS가 어떤
  이상징후를 우선 감시해야 하는지 (문 열림/응축기 오염/제빙기 냉동부하 등과 연결)

## 3. 정량적 절감 효과 (IR 발표용 핵심 문장 3개)
- "OOO원 → OOO원 절감" 형태의 발표에 바로 인용 가능한 한 문장짜리 핵심 카피 3개
- 절감 시뮬레이션 수치를 반드시 근거로 사용

## 4. 도입 로드맵 제안
- 1차 실증(소수 사업장) → 확대 단계별로, 어떤 업종부터 어떤 순서로 붙여야
  ROI가 가장 빨리 나올지 제안

## 5. 예상 반론과 대응 논리
- 심사위원이 던질 법한 날카로운 질문 2개와, 위 데이터를 근거로 한 답변
"""


def build_industry_deepdive_prompt(industry: dict, monthly_pattern: list[dict]) -> str:
    data_block = json.dumps(
        {"업종_집계": industry, "월별_추이": monthly_pattern},
        ensure_ascii=False,
        indent=2,
        default=str,
    )
    return f"""{_SYSTEM_CONTEXT}

다음은 특정 업종 하나에 대한 전기 사용량/요금 집계 데이터입니다.

```json
{data_block}
```

이 업종을 M-EMS 초기 실증 대상으로 제안하는 한국어 미니 브리핑을 작성해 주세요.
아래 항목을 포함하고, 반드시 위 데이터 수치를 인용하세요:
1. 이 업종이 전기를 많이/특이하게 쓰는 이유 (설비 특성 관점)
2. 이 업종에서 발생 가능한 대표 이상징후 3가지와 감지 방법
3. M-EMS 도입 시 예상되는 정량적 효과 한두 문장 (숫자 근거 포함)
4. 영업 피치에 쓸 수 있는 한 줄 카피
"""
