from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import data_service
from .gemini_service import (
    GeminiNotConfiguredError,
    build_industry_deepdive_prompt,
    build_market_strategy_prompt,
    generate_text,
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

app = FastAPI(
    title="M-EMS Strategy API",
    description="보령시 수산업 전기 사용량 예측 데이터를 근거로 한 에너지 절감/사업 전략 API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def root():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/industries")
def industries():
    return data_service.list_industries()


@app.get("/api/data")
def data(
    year: int | None = Query(None, description="연도 (2023~2025)"),
    month: int | None = Query(None, ge=1, le=12),
    industry_code: str | None = Query(None, description="예: A0331, C1021"),
):
    return data_service.get_records(year=year, month=month, industry_code=industry_code)


@app.get("/api/summary/industry")
def summary_industry(year: int | None = Query(None)):
    return data_service.summary_by_industry(year=year)


@app.get("/api/summary/monthly")
def summary_monthly(year: int | None = Query(None)):
    return data_service.summary_by_month(year=year)


@app.get("/api/summary/market")
def summary_market(year: int | None = Query(None)):
    return data_service.market_overview(year=year)


@app.get("/api/summary/savings")
def summary_savings(
    year: int | None = Query(None),
    industry_code: str | None = Query(None),
    usage_reduction_pct: float = Query(6.2, description="기본값: 경기도 실증 사용량 절감률"),
    cost_reduction_pct: float = Query(4.7, description="기본값: 경기도 실증 요금 절감률"),
    adoption_sites: int | None = Query(None, description="M-EMS 도입 사업장 수 (예: 1차 실증 20곳)"),
):
    return data_service.savings_scenario(
        year=year,
        industry_code=industry_code,
        usage_reduction_pct=usage_reduction_pct,
        cost_reduction_pct=cost_reduction_pct,
        adoption_sites=adoption_sites,
    )


@app.get("/api/summary/revenue")
def summary_revenue(
    customers: str = Query("20,50,200,400,1000", description="쉼표로 구분한 고객 수 목록"),
    monthly_fee: int = Query(49_900, description="1곳당 월 구독료(원)"),
):
    try:
        counts = [int(c.strip()) for c in customers.split(",") if c.strip()]
    except ValueError:
        raise HTTPException(400, "customers는 쉼표로 구분된 정수 목록이어야 합니다.")
    return data_service.revenue_scenario(counts, monthly_fee)


@app.get("/api/strategy/market")
def strategy_market(
    year: int | None = Query(None),
    adoption_sites: int | None = Query(20, description="절감 시뮬레이션에 반영할 도입 사업장 수"),
):
    scope_desc = f"{year}년 보령시 수산업 전체 업종" if year else "보령시 수산업 전체 업종(2023~2025)"
    market = data_service.market_overview(year=year)
    monthly = data_service.summary_by_month(year=year)
    savings = data_service.savings_scenario(year=year, adoption_sites=adoption_sites)
    revenue = data_service.revenue_scenario([20, 50, 200, 400, 1000])

    prompt = build_market_strategy_prompt(scope_desc, market, monthly, savings, revenue)
    try:
        report = generate_text(prompt)
    except GeminiNotConfiguredError as e:
        raise HTTPException(503, str(e))

    return {"scope": scope_desc, "report": report, "prompt_used": prompt}


@app.get("/api/strategy/industry/{industry_code}")
def strategy_industry(
    industry_code: str,
    year: int | None = Query(None),
    industry_name: str | None = Query(
        None, description="업종코드가 중복되는 경우(예: A0331) 정확한 업종을 지정"
    ),
):
    industry_rows = [
        row
        for row in data_service.summary_by_industry(year=year)
        if row["업종코드"] == industry_code and (industry_name is None or row["업종이름"] == industry_name)
    ]
    if not industry_rows:
        raise HTTPException(404, f"업종코드 '{industry_code}'를 찾을 수 없습니다.")

    monthly_pattern = data_service.get_records(
        year=year, industry_code=industry_code, industry_name=industry_name
    )

    prompt = build_industry_deepdive_prompt(industry_rows[0], monthly_pattern)
    try:
        report = generate_text(prompt)
    except GeminiNotConfiguredError as e:
        raise HTTPException(503, str(e))

    return {"industry": industry_rows[0], "report": report}
