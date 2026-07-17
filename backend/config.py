"""앱 설정 — 모든 값은 환경변수(.env)에서 읽습니다. (하드코딩 금지)"""
import os
from urllib.parse import quote_plus

from dotenv import load_dotenv

# backend/.env 로드
load_dotenv()


def build_database_uri():
    """DATABASE_URL 이 있으면 그대로, 없으면 개별 항목으로 조합.
    둘 다 없으면 None(=DB 미설정)을 반환하고, 이 경우에도 앱은 정상 기동됩니다."""
    url = os.getenv("DATABASE_URL")
    if url:
        return url

    host = os.getenv("DB_HOST")
    password = os.getenv("DB_PASSWORD")
    # 최소한 호스트와 비밀번호가 있어야 접속 문자열을 만듭니다.
    if host and password:
        user = os.getenv("DB_USER", "postgres")
        port = os.getenv("DB_PORT", "5432")
        name = os.getenv("DB_NAME", "postgres")
        # 비밀번호에 @ : / ! 같은 문자가 있어도 접속 문자열이 깨지지 않도록 인코딩합니다.
        return (
            f"postgresql+psycopg2://{quote_plus(user)}:{quote_plus(password)}"
            f"@{host}:{port}/{name}"
        )

    return None


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

    SQLALCHEMY_DATABASE_URI = build_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # DB 설정 여부 — 라우트에서 DB 미설정 시 안내 응답을 주기 위해 사용
    DATABASE_CONFIGURED = SQLALCHEMY_DATABASE_URI is not None

    CORS_ORIGINS = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if o.strip()
    ]
