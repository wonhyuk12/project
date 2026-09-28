import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

DATA_CSV_PATH = os.getenv("DATA_CSV_PATH") or str(
    BASE_DIR / "data" / "boryeong_fishery_electricity.csv"
)

# 경기도 '소규모시설 에너지관리시스템 설치 지원사업' 실증 결과.
# 절감 시나리오 계산의 기본값(default)으로 사용 — 근거: PPT 9페이지.
GYEONGGI_USAGE_REDUCTION_PCT = 6.2
GYEONGGI_COST_REDUCTION_PCT = 4.7
