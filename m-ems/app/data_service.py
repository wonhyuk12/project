"""
보령시 수산업 전기 예측 데이터 로딩 및 집계.

원본 CSV는 시(市) 통계·에너지공단 다소비 업종 기준을 토대로 만든
"추정(모델링)" 값입니다 (값의성격 컬럼 == "추정"). 연도별로 동일한 계절
패턴이 반복되는 예측 모델이며, 실제 스마트미터 실측값이 아닙니다.
데이터 성격에 대한 자세한 내용은 PROCESS.md를 참고하세요.
"""

from functools import lru_cache

import pandas as pd

from .config import DATA_CSV_PATH, GYEONGGI_COST_REDUCTION_PCT, GYEONGGI_USAGE_REDUCTION_PCT

_NUMERIC_COLUMNS = [
    "개소수(몇곳)",
    "한곳이한달쓰는전기(kWh)",
    "계절배수",
    "예상사용량(kWh)",
    "낮게볼때(-20%)",
    "높게볼때(+20%)",
    "신뢰구간아래",
    "신뢰구간위",
    "예상전기요금(원)",
    "전기단가(원/kWh)",
]


@lru_cache(maxsize=1)
def load_data() -> pd.DataFrame:
    df = pd.read_csv(DATA_CSV_PATH, encoding="utf-8-sig")
    for col in _NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _filter(
    df: pd.DataFrame,
    year: int | None,
    month: int | None,
    industry_code: str | None,
    industry_name: str | None = None,
):
    if year is not None:
        df = df[df["연도"] == year]
    if month is not None:
        df = df[df["월"] == month]
    if industry_code is not None:
        df = df[df["업종코드"] == industry_code]
    if industry_name is not None:
        df = df[df["업종이름"] == industry_name]
    return df


def list_industries() -> list[dict]:
    df = load_data()
    cols = ["업종코드", "업종이름", "전기계약종류", "개소수(몇곳)"]
    return (
        df[cols]
        .drop_duplicates()
        .sort_values("업종코드")
        .to_dict(orient="records")
    )


def get_records(
    year: int | None = None,
    month: int | None = None,
    industry_code: str | None = None,
    industry_name: str | None = None,
) -> list[dict]:
    df = _filter(load_data(), year, month, industry_code, industry_name)
    return df.sort_values(["연도", "월", "업종코드"]).to_dict(orient="records")


def summary_by_industry(year: int | None = None) -> list[dict]:
    df = _filter(load_data(), year, None, None)
    g = (
        df.groupby(["업종코드", "업종이름", "전기계약종류"])
        .agg(
            개소수=("개소수(몇곳)", "first"),
            총예상사용량_kWh=("예상사용량(kWh)", "sum"),
            총예상전기요금_원=("예상전기요금(원)", "sum"),
            평균계절배수=("계절배수", "mean"),
            레코드수=("월", "count"),  # 이 그룹에 포함된 연-월 행 개수 (= 개월 수)
        )
        .reset_index()
    )
    total_cost = g["총예상전기요금_원"].sum()
    g["비중_pct"] = (g["총예상전기요금_원"] / total_cost * 100).round(1)
    g["업체당_월평균요금_원"] = (
        g["총예상전기요금_원"] / g["개소수"] / g["레코드수"].replace(0, 1)
    ).round(0)
    g = g.drop(columns=["레코드수"])
    return g.sort_values("총예상전기요금_원", ascending=False).to_dict(orient="records")


def summary_by_month(year: int | None = None) -> dict:
    df = _filter(load_data(), year, None, None)
    g = (
        df.groupby("월")
        .agg(
            총예상사용량_kWh=("예상사용량(kWh)", "sum"),
            총예상전기요금_원=("예상전기요금(원)", "sum"),
            평균계절배수=("계절배수", "mean"),
        )
        .reset_index()
        .sort_values("월")
    )
    peak = g.loc[g["총예상전기요금_원"].idxmax()]
    off_peak = g.loc[g["총예상전기요금_원"].idxmin()]
    return {
        "monthly": g.to_dict(orient="records"),
        "peak_month": int(peak["월"]),
        "peak_month_cost_원": int(peak["총예상전기요금_원"]),
        "off_peak_month": int(off_peak["월"]),
        "off_peak_month_cost_원": int(off_peak["총예상전기요금_원"]),
    }


def market_overview(year: int | None = None) -> dict:
    df = _filter(load_data(), year, None, None)
    years = sorted(df["연도"].unique().tolist())
    by_industry = summary_by_industry(year)
    total_sites = int(load_data()[["업종코드", "개소수(몇곳)"]].drop_duplicates()["개소수(몇곳)"].sum())
    months = df["월"].nunique() or 12
    total_cost = int(df["예상전기요금(원)"].sum())
    total_usage = int(df["예상사용량(kWh)"].sum())
    return {
        "years_included": years,
        "months_covered": months,
        "total_business_sites": total_sites,
        "total_expected_usage_kWh": total_usage,
        "total_expected_cost_원": total_cost,
        "avg_unit_price_원_per_kWh": round(df["전기단가(원/kWh)"].mean(), 1),
        "top_industry": by_industry[0] if by_industry else None,
        "industry_breakdown": by_industry,
    }


def savings_scenario(
    year: int | None = None,
    industry_code: str | None = None,
    usage_reduction_pct: float = GYEONGGI_USAGE_REDUCTION_PCT,
    cost_reduction_pct: float = GYEONGGI_COST_REDUCTION_PCT,
    adoption_sites: int | None = None,
) -> dict:
    """
    경기도 '소규모시설 에너지관리시스템 설치 지원사업' 실증 결과(사용량 -6.2%,
    요금 -4.7%)를 기본 절감률로 사용해, M-EMS 도입 시 예상 절감액을 계산합니다.
    adoption_sites를 지정하면 전체 업종 대상 사업장 수 중 해당 개수만 도입했다고
    가정한 비례 절감액도 함께 계산합니다 (1차 실증 20곳, 1년차 목표 50곳 등).
    """
    df = _filter(load_data(), year, None, industry_code)
    total_cost = df["예상전기요금(원)"].sum()
    total_usage = df["예상사용량(kWh)"].sum()
    total_sites = (
        load_data()[["업종코드", "개소수(몇곳)"]].drop_duplicates()["개소수(몇곳)"].sum()
        if industry_code is None
        else df["개소수(몇곳)"].iloc[0] if len(df) else 0
    )

    usage_saved = total_usage * usage_reduction_pct / 100
    cost_saved = total_cost * cost_reduction_pct / 100

    result = {
        "basis": "경기도 소규모시설 EMS 지원사업 실증치 (사용량 -6.2%, 요금 -4.7%)"
        if usage_reduction_pct == GYEONGGI_USAGE_REDUCTION_PCT
        else "사용자 지정 절감률",
        "usage_reduction_pct": usage_reduction_pct,
        "cost_reduction_pct": cost_reduction_pct,
        "baseline_total_usage_kWh": int(total_usage),
        "baseline_total_cost_원": int(total_cost),
        "projected_usage_saved_kWh": int(usage_saved),
        "projected_cost_saved_원": int(cost_saved),
        "total_business_sites_in_scope": int(total_sites),
    }

    if adoption_sites is not None and total_sites:
        share = min(adoption_sites, total_sites) / total_sites
        result["adoption_sites"] = adoption_sites
        result["adoption_share_pct"] = round(share * 100, 1)
        result["adoption_projected_cost_saved_원"] = int(cost_saved * share)
        result["adoption_projected_usage_saved_kWh"] = int(usage_saved * share)

    return result


def revenue_scenario(customer_counts: list[int], monthly_fee_원: int = 49_900) -> list[dict]:
    """구독료 x 고객수 기준 연간 매출 시뮬레이션 (IR 12페이지 표 재현/커스터마이즈용)."""
    return [
        {
            "customers": c,
            "monthly_fee_원": monthly_fee_원,
            "monthly_revenue_원": c * monthly_fee_원,
            "annual_revenue_원": c * monthly_fee_원 * 12,
        }
        for c in customer_counts
    ]
