@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo   GGACHI COFFEE BAR - Backend
echo ============================================================

REM --- 1) Python 확인 (python -> py 순서) ---
set "PY="
where python >nul 2>&1 && set "PY=python"
if not defined PY ( where py >nul 2>&1 && set "PY=py -3" )
if not defined PY (
  echo [오류] Python 이 설치되어 있지 않습니다.
  echo        https://www.python.org/downloads/ 에서 설치할 때
  echo        "Add python.exe to PATH" 를 체크한 뒤 다시 실행하세요.
  pause
  exit /b 1
)

REM --- 2) 가상환경 준비 (.venv\Scripts\python.exe 가 없으면 생성) ---
if not exist ".venv\Scripts\python.exe" (
  echo [1/3] 가상환경 생성 중... ^(처음 한 번만^)
  %PY% -m venv .venv
  if errorlevel 1 (
    echo [오류] 가상환경 생성 실패.
    pause
    exit /b 1
  )
)
set "VPY=.venv\Scripts\python.exe"

REM --- 3) 패키지 설치 ---
echo [2/3] 패키지 설치 확인 중...
"%VPY%" -m pip install -q --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
  echo [오류] 패키지 설치 실패. 인터넷 연결을 확인하세요.
  pause
  exit /b 1
)

REM --- 4) 서버 실행 ---
echo [3/3] 서버 시작:  http://localhost:5000
echo        헬스체크:  http://localhost:5000/api/health
echo        (종료하려면 이 창에서 Ctrl+C)
echo ------------------------------------------------------------
"%VPY%" wsgi.py

pause
