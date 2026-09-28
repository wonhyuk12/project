import sys
import io
import json
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

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

url = "https://apis.openapi.sk.com/puzzle/subway/congestion/stat/train/stations/133"
headers = {"Accept": "application/json", "appKey": app_key}
params = {"dow": "MON", "hh": "08"}

response = requests.get(url, headers=headers, params=params, timeout=10)
print("HTTP status:", response.status_code)
data = response.json()
print(json.dumps(data, ensure_ascii=False, indent=2)[:1500])
