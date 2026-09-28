# ===================================================================
# config.py  —  ".env 파일의 값을 안전하게 읽어오는 곳"
# -------------------------------------------------------------------
# 왜 이 파일이 따로 있나요?
#   - API 키 같은 비밀값을 코드 여기저기에 하드코딩하면 안 되기 때문이에요.
#   - .env 파일에 값을 모아두고, 이 파일이 그 값을 "한 번" 읽어서
#     프로그램 전체가 이 곳을 통해서만 설정값을 꺼내 쓰게 합니다.
#   - 그러면 나중에 키가 바뀌어도 .env 만 고치면 되고, 코드는 안 바꿔도 돼요.
#
# 사용 라이브러리: python-dotenv (이미 가상환경에 설치되어 있음)
#   - .env 파일을 읽어 os.environ(환경변수)에 넣어주는 도구입니다.
# ===================================================================

import os
from dotenv import load_dotenv  # .env 파일을 읽어주는 도구


# .env 파일을 찾아서 값을 읽어 들입니다.
#   - 이 코드는 프로그램이 시작될 때 딱 한 번 실행됩니다.
load_dotenv()


def _require(key: str) -> str:
    """
    .env 에서 값을 꺼내되, 값이 없으면 '무엇이 빠졌는지' 알려주며 멈춥니다.
    (키를 빠뜨린 채 서버가 이상하게 도는 것을 막기 위한 안전장치)
    """
    value = os.getenv(key)
    if not value:
        raise RuntimeError(
            f".env 파일에 {key} 값이 없습니다. .env.example 을 참고해 채워 주세요."
        )
    return value


class Settings:
    """
    .env 파일 안의 값들을 담는 '설정 상자'입니다.
    프로그램의 다른 곳에서는  from backend.config import settings  로 가져와
    settings.SUPABASE_URL 처럼 꺼내 씁니다.
    """

    def __init__(self):
        # --- Supabase 관련 ---
        self.SUPABASE_URL: str = _require("SUPABASE_URL")           # 프로젝트 주소
        self.SUPABASE_ANON_KEY: str = _require("SUPABASE_ANON_KEY")  # 프론트(로그인)용 공개 키
        self.SUPABASE_SERVICE_KEY: str = _require("SUPABASE_SERVICE_KEY")  # 백엔드 전용 비밀 키

        # --- Gemini 관련 ---
        self.GEMINI_API_KEY: str = _require("GEMINI_API_KEY")       # AI 글자 인식용 키


# 프로그램 전체에서 딱 하나만 만들어 두고 공유하는 '설정 객체'입니다.
settings = Settings()
