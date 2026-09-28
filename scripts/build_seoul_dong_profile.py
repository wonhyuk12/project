"""
서울시 행정동별 종합 프로필 테이블 만들기 (군집화 입력용)

전체 흐름 (5단계):
  1) SGIS 인증 -> accessToken 발급
  2) 서울시 행정동 경계(폴리곤, EPSG:5179) 가져오기
  3) 서울시 행정동별 인구통계(고령화지수, 노년부양비 등) 가져오기
  4) 버스정류장 좌표(WGS84)를 행정동 경계 좌표계(EPSG:5179)로 변환한 뒤,
     "이 정류장이 어느 행정동 안에 있는지" 점-폴리곤(point-in-polygon) 매칭
  5) 매칭 결과로 버스 승하차 데이터를 행정동 단위로 집계하고,
     인구통계와 합쳐서 최종 테이블 저장

각 단계 결과를 print로 검증하면서 진행한다 (조용히 넘어가지 않음).
"""
import os
import json
import requests
import pandas as pd
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
from pyproj import Transformer

BASE = "C:/Users/user/Desktop/교통 데이터 분석"
DATA = f"{BASE}/data/seoul_opendata"
ENV_PATH = f"{BASE}/.env"

# ---------- 0) 키 로드 ----------
env = {}
with open(ENV_PATH, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v

# ---------- 1) SGIS 인증 ----------
auth = requests.get(
    "https://sgisapi.mods.go.kr/OpenAPI3/auth/authentication.json",
    params={"consumer_key": env["SGIS_CONSUMER_KEY"], "consumer_secret": env["SGIS_CONSUMER_SECRET"]},
).json()
assert auth["errCd"] == 0, f"SGIS 인증 실패: {auth}"
token = auth["result"]["accessToken"]
print(f"[1/5] SGIS 인증 완료 (토큰 만료: {auth['result']['accessTimeout']})")

# ---------- 2) 행정동 경계 (있으면 재사용, 없으면 새로 받기) ----------
boundary_path = f"{DATA}/서울_행정동_경계.geojson"
if os.path.exists(boundary_path):
    with open(boundary_path, encoding="utf-8") as f:
        boundary = json.load(f)
else:
    res = requests.get(
        "https://sgisapi.mods.go.kr/OpenAPI3/boundary/hadmarea.geojson",
        params={"accessToken": token, "adm_cd": "11", "year": "2023", "low_search": "2"},
    ).json()
    assert res.get("errCd") == 0, f"경계 API 실패: {res}"
    boundary = res
    with open(boundary_path, "w", encoding="utf-8") as f:
        json.dump(boundary, f, ensure_ascii=False)
print(f"[2/5] 행정동 경계 {len(boundary['features'])}개 로드")

# ---------- 3) 행정동별 인구통계 ----------
pop_res = requests.get(
    "https://sgisapi.mods.go.kr/OpenAPI3/stats/population.json",
    params={"accessToken": token, "year": "2023", "adm_cd": "11", "low_search": "2"},
).json()
assert "result" in pop_res, f"인구통계 API 실패: {pop_res}"
pop_df = pd.DataFrame(pop_res["result"])
keep_cols = ["adm_cd", "adm_nm", "tot_ppltn", "tot_house", "avg_age",
             "ppltn_dnsty", "oldage_suprt_per", "aged_child_idx", "juv_suprt_per"]
pop_df = pop_df[keep_cols]
for c in keep_cols[2:]:
    pop_df[c] = pd.to_numeric(pop_df[c], errors="coerce")
pop_df.to_csv(f"{DATA}/서울_행정동별_인구통계_2023.csv", index=False, encoding="utf-8-sig")
print(f"[3/5] 인구통계 {len(pop_df)}개 행정동 저장 (컬럼: {keep_cols})")

# ---------- 4) 정류장 -> 행정동 공간 매칭 ----------
# 4-1. 행정동 폴리곤 준비 (이미 EPSG:5179)
polygons, adm_cds, adm_nms = [], [], []
for feat in boundary["features"]:
    polygons.append(shape(feat["geometry"]))
    adm_cds.append(feat["properties"]["adm_cd"])
    adm_nms.append(feat["properties"]["adm_nm"])
tree = STRtree(polygons)

# 4-2. 정류장 좌표 WGS84(경위도) -> EPSG:5179 변환
stops = pd.read_csv(f"{DATA}/버스정류소_위치정보_전체.csv")
transformer = Transformer.from_crs("EPSG:4326", "EPSG:5179", always_xy=True)
xs, ys = transformer.transform(stops["XCRD"].values, stops["YCRD"].values)

# 4-3. point-in-polygon 매칭
matched_adm_cd, matched_adm_nm = [], []
for x, y in zip(xs, ys):
    pt = Point(x, y)
    idx_candidates = tree.query(pt)  # 후보 폴리곤 인덱스 (bbox 기준)
    found_cd, found_nm = None, None
    for idx in idx_candidates:
        if polygons[idx].contains(pt):
            found_cd, found_nm = adm_cds[idx], adm_nms[idx]
            break
    matched_adm_cd.append(found_cd)
    matched_adm_nm.append(found_nm)

stops["adm_cd"] = matched_adm_cd
stops["adm_nm"] = matched_adm_nm
n_matched = stops["adm_cd"].notna().sum()
print(f"[4/5] 정류장 {len(stops)}개 중 {n_matched}개 매칭 ({n_matched/len(stops)*100:.1f}%), "
      f"미매칭 {len(stops)-n_matched}개 (경계 밖/좌표 오차 등)")
stops.to_csv(f"{DATA}/서울_정류장_행정동매칭.csv", index=False, encoding="utf-8-sig")

# ---------- 5) 버스 승하차 데이터 행정동 단위 집계 ----------
ride = pd.read_csv(f"{DATA}/버스_노선별_정류장별_시간대별_승하차인원_202608.csv")
on_cols = [c for c in ride.columns if c.startswith("HR_") and "GET_ON" in c]
off_cols = [c for c in ride.columns if c.startswith("HR_") and "GET_OFF" in c]
ride["TOTAL_ON"] = ride[on_cols].sum(axis=1)
ride["TOTAL_OFF"] = ride[off_cols].sum(axis=1)

stop_to_dong = stops.set_index("STOPS_NO")[["adm_cd", "adm_nm"]]
ride = ride.join(stop_to_dong, on="STOPS_ID")
n_ride_matched = ride["adm_cd"].notna().sum()
print(f"      승하차 레코드 {len(ride)}건 중 {n_ride_matched}건 행정동 매칭 "
      f"({n_ride_matched/len(ride)*100:.1f}%)")

dong_bus = ride.dropna(subset=["adm_cd"]).groupby(["adm_cd", "adm_nm"]).agg(
    정류장수=("STOPS_ID", "nunique"),
    노선수=("RTE_NO", "nunique"),
    총승차=("TOTAL_ON", "sum"),
    총하차=("TOTAL_OFF", "sum"),
).reset_index()
dong_bus.to_csv(f"{DATA}/서울_행정동별_버스집계_202608.csv", index=False, encoding="utf-8-sig")

# ---------- 최종: 인구통계 + 버스집계 합치기 ----------
final = pop_df.merge(dong_bus, on="adm_cd", how="left", suffixes=("", "_bus"))
final_path = f"{DATA}/서울_행정동_종합프로필.csv"
final.to_csv(final_path, index=False, encoding="utf-8-sig")
print(f"[5/5] 최종 프로필 테이블 저장: {final_path} ({len(final)}행 x {len(final.columns)}열)")
print(final.head())
