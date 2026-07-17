#!/usr/bin/env bash
# GGACHI COFFEE BAR - Backend (macOS / Linux 실행 스크립트)
# 사용:  bash run.sh   (또는  chmod +x run.sh && ./run.sh)
set -e
cd "$(dirname "$0")"

echo "============================================================"
echo "  GGACHI COFFEE BAR - Backend"
echo "============================================================"

# 1) Python 확인
PY=""
command -v python3 >/dev/null 2>&1 && PY=python3
[ -z "$PY" ] && command -v python >/dev/null 2>&1 && PY=python
if [ -z "$PY" ]; then
  echo "[오류] Python 이 설치되어 있지 않습니다. https://www.python.org/downloads/"
  exit 1
fi

# 2) 가상환경 준비 (처음 한 번만)
if [ ! -x ".venv/bin/python" ]; then
  echo "[1/3] 가상환경 생성 중... (처음 한 번만)"
  "$PY" -m venv .venv
fi
VPY=".venv/bin/python"

# 3) 패키지 설치
echo "[2/3] 패키지 설치 확인 중..."
"$VPY" -m pip install -q --disable-pip-version-check -r requirements.txt

# 4) 서버 실행
echo "[3/3] 서버 시작:  http://localhost:5000  (종료: Ctrl+C)"
echo "------------------------------------------------------------"
exec "$VPY" wsgi.py
