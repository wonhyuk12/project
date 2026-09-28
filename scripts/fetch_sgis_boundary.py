"""
SGIS API에서 서울시 행정동 경계 데이터를 가져오는 스크립트.

흐름:
1) consumer_key + consumer_secret 으로 accessToken 발급받기 (로그인)
2) 그 accessToken을 넣어서 실제 데이터(행정동 경계) 요청하기
3) 받은 결과를 파일로 저장하기
"""
import os
import json
import requests

# .env 파일에서 키 값 읽어오기
ENV_PATH = "C:/Users/user/Desktop/교통 데이터 분석/.env"
env = {}
with open(ENV_PATH, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v

CONSUMER_KEY = env["SGIS_CONSUMER_KEY"]
CONSUMER_SECRET = env["SGIS_CONSUMER_SECRET"]

# 1) 토큰 발급 요청
auth_url = "https://sgisapi.mods.go.kr/OpenAPI3/auth/authentication.json"
auth_res = requests.get(auth_url, params={
    "consumer_key": CONSUMER_KEY,
    "consumer_secret": CONSUMER_SECRET,
}).json()

print("=== 1) 인증 응답 ===")
print(auth_res)

if auth_res.get("errCd") != 0:
    print("인증 실패, 여기서 중단")
    raise SystemExit(1)

token = auth_res["result"]["accessToken"]

# 2) 행정동 경계 데이터 요청 (서울시 전체, 시도 아래 2단계=행정동까지)
boundary_url = "https://sgisapi.mods.go.kr/OpenAPI3/boundary/hadmarea.geojson"
boundary_res = requests.get(boundary_url, params={
    "accessToken": token,
    "adm_cd": "11",
    "year": "2023",
    "low_search": "2",
})

print("\n=== 2) 경계 데이터 응답 (앞부분만) ===")
print(boundary_res.text[:500])

# 3) 성공했으면 파일로 저장
try:
    data = boundary_res.json()
    if data.get("features"):
        out_path = "C:/Users/user/Desktop/교통 데이터 분석/data/seoul_opendata/서울_행정동_경계.geojson"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        print(f"\n저장 완료: {out_path} (행정동 {len(data['features'])}개)")
    else:
        print("\n features가 비어있음 -> 아직 권한/파라미터 문제가 있는 상태")
except Exception as e:
    print("JSON 파싱 실패:", e)
