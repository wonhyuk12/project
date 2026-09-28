# ===================================================================
# make_icons.py  —  "PWA 아이콘(icon-192.png / icon-512.png) 만드는 1회용 스크립트"
# -------------------------------------------------------------------
# 왜 필요한가요?
#   - manifest.json 이 /icon-192.png, /icon-512.png 를 가리키는데 파일이 없으면
#     브라우저 콘솔에 경고가 떠요. 이 스크립트로 두 파일을 만들어 넣습니다.
#   - 디자인: 특정 업종(금은방 등)에 얽매이지 않는 '매입·판매' 느낌의 단순 도형.
#     진한 네이비 배경 + 금색 쇼핑백(상자/태그) 모양. 글자(한자)는 쓰지 않아요.
#     → 업종이 금은방이든 시계든 중고폰이든 어울리는 중립 아이콘입니다.
#
# 실행 방법 (Gold_plaza 폴더에서, 가상환경 python 으로):
#   ./goldbusiness/Scripts/python.exe backend/make_icons.py
#   → frontend/icon-192.png, frontend/icon-512.png 가 생성됩니다.
#
# ※ 도형만 그리므로 폰트가 필요 없습니다. 한 번 만들어 두면 다시 실행할 일은 거의 없어요.
# ===================================================================

from pathlib import Path

from PIL import Image, ImageDraw


# 아이콘을 저장할 폴더: 이 파일 기준 (backend → 한 칸 위 → frontend)
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

# 색 (앱의 style.css 와 같은 계열: 진한 네이비 배경 + 금색 포인트)
BG_COLOR = (26, 39, 68)     # 진한 네이비 (#1a2744)
GOLD_COLOR = (201, 162, 39)  # 금색 (#c9a227)


def make_icon(size: int) -> Image.Image:
    """
    한 변이 size(px)인 정사각형 아이콘 이미지를 만들어 돌려줍니다.
      - 배경을 진한 네이비로 채우고, 가운데에 금색 '쇼핑백(상자+손잡이)' 도형을 그립니다.
      - 좌표는 전부 size 에 대한 '비율'로 잡아, 192/512 어느 크기든 똑같은 모양이 나옵니다.
    """
    # (1) 네이비 배경으로 채운 정사각형 캔버스
    img = Image.new("RGB", (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # 비율을 px 로 바꿔 주는 짧은 도우미
    def px(ratio: float) -> int:
        return int(size * ratio)

    # (2) 손잡이 두 개 (몸통 위에 얹히는 반원 U 자) — 먼저 그려 몸통이 밑동을 덮게 합니다.
    #     PIL 의 arc 각도는 3시=0°, 시계방향 증가라 180°~360° 가 '위쪽 반원'입니다.
    handle_w = max(2, px(0.035))         # 손잡이 선 두께
    handle_r = px(0.075)                 # 손잡이 반지름
    handle_cy = px(0.40)                 # 손잡이 중심 높이(= 몸통 윗변 근처)
    for cx in (px(0.40), px(0.60)):      # 왼쪽·오른쪽 손잡이
        draw.arc(
            [cx - handle_r, handle_cy - handle_r, cx + handle_r, handle_cy + handle_r],
            start=180, end=360, fill=GOLD_COLOR, width=handle_w,
        )

    # (3) 가방 몸통 (모서리를 둥글린 금색 사각형)
    draw.rounded_rectangle(
        [px(0.28), px(0.40), px(0.72), px(0.78)],
        radius=px(0.06), fill=GOLD_COLOR,
    )

    return img


def main():
    FRONTEND_DIR.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        out_path = FRONTEND_DIR / f"icon-{size}.png"
        make_icon(size).save(out_path, "PNG")
        print(f"만듦: {out_path}")


if __name__ == "__main__":
    main()
