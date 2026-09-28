"""
예시: SGIS 인구통계 API 하나만 HTTP로 불러오기
"""
import requests

CONSUMER_KEY = "eb39ec9c06ff443fbd7c"
CONSUMER_SECRET = "98b78c98cd5c4aeaa2e2"

# 1) 토큰 받기
auth_url = "https://sgisapi.mods.go.kr/OpenAPI3/auth/authentication.json"
auth_res = requests.get(auth_url, params={
    "consumer_key": CONSUMER_KEY,
    "consumer_secret": CONSUMER_SECRET,
}).json()
print("인증 응답:", auth_res)

token = auth_res["result"]["accessToken"]

# 2) 인구통계 데이터 요청 (서울시 adm_cd=11, 하위 행정동까지 low_search=2)
pop_url = "https://sgisapi.mods.go.kr/OpenAPI3/stats/population.json"
pop_res = requests.get(pop_url, params={
    "accessToken": token,
    "year": "2023",
    "adm_cd": "11",
    "low_search": "2",
}).json()

print("결과 개수:", len(pop_res["result"]))
print("첫 번째 행정동 데이터:", pop_res["result"][0])
