"""초기 시드 데이터 — 프론트 data/news.js 와 동일한 소식 3건.
init-db 명령 실행 시, news 테이블이 비어 있으면 넣습니다.
"""
from datetime import datetime

SEED_NEWS = [
    {
        "title": "쫀득한 까치 브라우니 출시",
        "is_new": True,
        "views": 128,
        "created_at": datetime(2024, 6, 8),
        "body": (
            "안녕하세요, 까치커피바입니다.\n\n"
            "매장에서 직접 만드는 수제 더블초코 브라우니가 새롭게 출시되었습니다. "
            "꾸덕하고 진한 초콜릿의 풍미와 쫀득한 식감을 그대로 담아, 커피 한 잔과 함께 "
            "즐기기 좋은 디저트로 준비했습니다.\n\n"
            "•  가격 : 4,500원\n"
            "•  판매 : 매장 한정 (소진 시 조기 마감될 수 있습니다)\n\n"
            "갓 구운 브라우니의 매력을 매장에서 만나보세요. 따뜻한 커피와 함께 특별한 시간 보내시길 바랍니다.\n\n"
            "— 까치커피바 드림"
        ),
    },
    {
        "title": "까치커피바 키링 굿즈 출시",
        "is_new": True,
        "views": 96,
        "created_at": datetime(2024, 6, 5),
        "body": "(상세 내용 준비 중입니다.)",
    },
    {
        "title": "6월 매장 운영 안내",
        "is_new": False,
        "views": 210,
        "created_at": datetime(2024, 5, 28),
        "body": "(상세 내용 준비 중입니다.)",
    },
]


def seed_news():
    """news 테이블이 비어 있으면 시드 데이터를 넣습니다."""
    from .extensions import db
    from .models import News

    if News.query.count() > 0:
        return 0

    for item in SEED_NEWS:
        db.session.add(News(category="공지", author="까치커피바", **item))
    db.session.commit()
    return len(SEED_NEWS)
