# 언제콜(EonjeCall) 프로토타입 - 서울역 데모
# 입력: 목적지 + 도착 희망 시각 -> 출력: 선택지 A(대중교통, TMAP 실시간 혼잡도 API) / 선택지 B(이동지원센터)
import math
import sys
import io
import requests
import pandas as pd

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

CENTERS_PATH = r"C:\Users\user\Desktop\교통 데이터 분석\전국교통약자이동지원센터정보표준데이터-20260922.xls"
ENV_PATH = r"C:\Users\user\Desktop\교통 데이터 분석\.env"
TMAP_CONGESTION_URL = "https://apis.openapi.sk.com/puzzle/subway/congestion/stat/train/stations/{code}"

STATION_COORDS = {
    "서울역": (37.554742, 126.972090, "중구"),
}
STATION_TMAP_CODE = {
    "서울역": "133",  # 1호선 서울역
}


def load_env():
    env = {}
    with open(ENV_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v
    return env


def fetch_hour_congestion(station_code, hh, dow="MON"):
    app_key = load_env().get("TMAP_APP_KEY")
    url = TMAP_CONGESTION_URL.format(code=station_code)
    headers = {"Accept": "application/json", "appKey": app_key}
    params = {"dow": dow, "hh": f"{hh:02d}"}
    resp = requests.get(url, headers=headers, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


def parse_hhmm(s):
    return int(s[:2]), int(s[3:5])


def congestion_choice(station, current_time, deadline_time, dow="MON"):
    """TMAP 지하철 혼잡도 API(10분 단위, 실시간 통계)로 구간 내 최적 출발시각을 계산."""
    station_code = STATION_TMAP_CODE.get(station)
    if not station_code:
        return None

    ch, cm = parse_hhmm(current_time)
    dh, dm = parse_hhmm(deadline_time)
    hours = list(range(ch, dh + 1)) if dh >= ch else [ch]

    slots = {}  # "HH:MM" -> (혼잡도, 진입 방면 설명) — 여러 구간 중 최댓값(보수적 기준)
    for h in hours:
        data = fetch_hour_congestion(station_code, h, dow)
        for seg in data.get("contents", {}).get("stat", []):
            seg_desc = f"{seg.get('endStationName', '')} 방면"
            for pt in seg.get("data", []):
                val = pt.get("congestionTrain")
                if val is None:
                    continue
                key = f"{pt['hh']}:{pt['mm']}"
                if key not in slots or val > slots[key][0]:
                    slots[key] = (val, seg_desc)

    if not slots:
        return None

    def to_min(key):
        h, m = key.split(":")
        return int(h) * 60 + int(m)

    cur_target = ch * 60 + cm
    dl_target = dh * 60 + dm

    now_key = min(slots.keys(), key=lambda k: abs(to_min(k) - cur_target))
    now_val, now_seg = slots[now_key]

    window_keys = [k for k in slots if cur_target <= to_min(k) <= dl_target] or [now_key]
    best_key = min(window_keys, key=lambda k: slots[k][0])
    best_val, best_seg = slots[best_key]

    return {
        "now_time": now_key, "now_val": now_val, "now_seg": now_seg,
        "best_time": best_key, "best_val": best_val, "best_seg": best_seg,
    }


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def center_choice(user_lat, user_lon, user_district):
    df = pd.read_excel(CENTERS_PATH, header=1)
    df = df.dropna(subset=["위도", "경도"])
    df["dist_km"] = df.apply(
        lambda r: haversine_km(user_lat, user_lon, float(r["위도"]), float(r["경도"])), axis=1
    )
    df = df.sort_values("dist_km")
    nearest = df.iloc[0]

    covers = user_district in str(nearest["차량관내운행지역"])
    return {
        "name": nearest["교통약자이동지원센터명"],
        "region": nearest["제공기관명"],
        "dist_km": nearest["dist_km"],
        "covers_user": covers,
        "service_area": nearest["차량관내운행지역"],
        "reserve_end": nearest["평일예약접수운영종료시각"],
        "op_end": nearest["차량평일운행종료시각"],
    }


def recommend(station, current_time, deadline_time, dow="MON"):
    lat, lon, district = STATION_COORDS[station]

    print(f"=== 언제콜 데모: {station} / {dow} 현재 {current_time} / 도착 희망 {deadline_time} ===")
    print("    (선택지 A는 TMAP 지하철 혼잡도 실시간 API, 10분 단위)\n")

    cg = congestion_choice(station, current_time, deadline_time, dow)
    print("[선택지 A] 지금/구간 내 대중교통")
    if cg:
        print(f"  현재({cg['now_time']}) 혼잡도: {cg['now_seg']} {cg['now_val']}%")
        print(f"  {current_time}~{deadline_time} 구간 최저 혼잡도: "
              f"{cg['best_seg']} {cg['best_val']}% ({cg['best_time']} 출발 권장)")
    else:
        print("  해당 역 혼잡도 데이터 없음")

    print()
    cc = center_choice(lat, lon, district)
    print("[선택지 B] 이동지원센터 예약")
    print(f"  가장 가까운 등록 센터: {cc['name']} ({cc['region']}, 직선거리 {cc['dist_km']:.1f}km)")
    print(f"  평일 예약마감 {cc['reserve_end']} / 차량운행종료 {cc['op_end']}")
    if cc["covers_user"]:
        print(f"  → {station}({district}) 관내 서비스 대상 O — 예약 가능")
    else:
        print(f"  → 서비스 범위: '{cc['service_area']}' (={district} 미포함) → {station} 기준 이용 불가")
        print(f"  → 전국표준데이터 기준 {station} 인근엔 이용 가능한 이동지원센터가 없음")
        print(f"     (서울시 자체 시스템인 서울동행맵/장애인콜택시로 안내 필요 — 데이터 사각지대 실증 사례)")


if __name__ == "__main__":
    recommend("서울역", "17시00분", "20시30분")
