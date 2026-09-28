import os
import requests

ENV_PATH = r"C:\Users\user\Desktop\교통 데이터 분석\.env"

env = {}
with open(ENV_PATH, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k] = v

app_key = env.get("TMAP_APP_KEY")
print("TMAP_APP_KEY loaded:", bool(app_key), "length:", len(app_key) if app_key else 0)

url = "https://apis.openapi.sk.com/transit/routes"
headers = {"appKey": app_key, "Content-Type": "application/json"}
# 서울역 -> 강남역 샘플 좌표
body = {
    "startX": "126.972790", "startY": "37.554648",
    "endX": "127.027621", "endY": "37.497925",
    "count": 1,
}

try:
    resp = requests.post(url, headers=headers, json=body, timeout=10)
    print("HTTP status:", resp.status_code)
    text = resp.text
    print("응답 일부(최대 500자):")
    print(text[:500])
except Exception as e:
    print("요청 실패:", repr(e))
