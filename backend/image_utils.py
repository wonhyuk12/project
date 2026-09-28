# ===================================================================
# image_utils.py  —  "사진을 작게 압축하는 일꾼" (Pillow 사용)
# -------------------------------------------------------------------
# 왜 압축하나요?
#   - 요즘 폰 사진은 용량이 큽니다(수 MB). 그대로 저장/전송하면 느리고 비싸요.
#   - 그래서 저장하기 전에:
#       1) 긴 변을 1500px 로 줄이고 (리사이즈)
#       2) JPEG 품질 85 로 압축
#     해서 '가벼운 사진'으로 만든 뒤, 이 압축본만 저장/AI전송에 씁니다.
# ===================================================================

import io  # 파일이 아니라 '메모리 위에서' 이미지를 다루기 위한 도구

from PIL import Image, ImageOps  # Pillow: 파이썬 이미지 처리 라이브러리


# 긴 변의 최대 길이(px)와 JPEG 품질을 상수로 둡니다. (나중에 바꾸기 쉽게)
MAX_LONG_EDGE = 1500   # 가로·세로 중 긴 쪽을 이 길이 이하로 줄임
JPEG_QUALITY = 85      # JPEG 압축 품질 (1~95, 높을수록 고화질·큰 용량)


def compress_image(raw_bytes: bytes) -> bytes:
    """
    원본 사진의 '바이트(bytes)'를 받아서,
    리사이즈 + JPEG 압축한 '가벼운 사진의 바이트'를 돌려줍니다.

    - 입력  raw_bytes : 업로드된 원본 사진 데이터
    - 출력  bytes      : 압축된 JPEG 사진 데이터
    """

    # (1) 바이트 → Pillow 이미지 객체로 열기
    image = Image.open(io.BytesIO(raw_bytes))

    # (2) 폰 사진은 '회전 정보(EXIF)'가 따로 들어있는 경우가 많아요.
    #     이걸 실제 픽셀 방향으로 바로잡아 줍니다. (안 하면 옆으로 누운 사진이 됨)
    image = ImageOps.exif_transpose(image)

    # (3) JPEG 로 저장하려면 색상 모드가 RGB 여야 합니다.
    #     (투명(RGBA)이나 흑백(P) 사진일 수 있으니 RGB 로 통일)
    if image.mode != "RGB":
        image = image.convert("RGB")

    # (4) 긴 변이 1500px 를 넘으면 비율을 유지하며 줄입니다.
    #     thumbnail() 은 가로세로 비율을 자동으로 지켜줍니다.
    image.thumbnail((MAX_LONG_EDGE, MAX_LONG_EDGE))

    # (5) 결과를 파일이 아닌 '메모리 버퍼'에 JPEG 로 저장합니다.
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)

    # (6) 버퍼 안의 최종 바이트를 돌려줍니다.
    return buffer.getvalue()
