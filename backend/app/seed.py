"""초기 시드 데이터 — 현재 프론트 화면에 하드코딩돼 있던 콘텐츠를 그대로 DB로 옮긴 것.

init-db 명령 실행 시, 각 테이블이 비어 있을 때만 삽입합니다(이미 데이터가 있으면 건너뜀).
가격은 정수(원)로만 넣습니다. 화면의 "5,500원" 포맷은 프론트가 담당합니다.
"""
from datetime import datetime

# ── store_info ────────────────────────────────────────────────────────────
STORE_INFO = {
    # id 는 넣지 않습니다. GENERATED ALWAYS AS IDENTITY 라 명시적 삽입이 거부됩니다.
    # 빈 테이블에 처음 넣으면 시퀀스가 1 을 주므로 CHECK (id = 1) 도 자동으로 만족합니다.
    "brand_name_ko": "까치커피바",
    "brand_name_en": "GGACHI COFFEE BAR",
    "phone": "0507-1445-6303",
    "address": "대전 유성구 대학로81번길 59 101호",
    "opening_hours": "월–토 08:00–20:00 · 일요일 12:00–20:00",
    "instagram": "@GGachi_coffeebar",
}

# ── menu_categories + menu_items ──────────────────────────────────────────
# sort_order 1·2 = 메뉴판 좌열, 3·4 = 우열 (프론트가 순서대로 2열로 나눠 배치)
MENU = [
    {
        "name_en": "COFFEE",
        "name_ko": "커피",
        "sort_order": 1,
        "items": [
            {"name": "아메리카노", "price": 3800},
            {"name": "콜드브루 커피", "note": "디카페인 변경 가능", "price": 3800},
            {"name": "핸드드립 커피", "price": 5000},
            {"name": "까치 콜드브루 원액 250ml", "price": 6000},
            {"name": "410ml 아이스 아메리카노", "price": 1200, "is_representative": True},
        ],
    },
    {
        "name_en": "LATTE",
        "name_ko": "라떼",
        "sort_order": 2,
        "items": [
            {"name": "카페라떼", "price": 4500},
            {"name": "콜드브루 라떼", "note": "디카페인 변경 가능", "price": 4400},
            {"name": "까치라떼", "price": 5500, "is_representative": True},
            {"name": "더블초코라떼", "price": 4500},
            {"name": "까치 마시멜로 모카", "price": 5500},
            {"name": "410ml 카페라떼", "price": 1700},
        ],
    },
    {
        "name_en": "SMOOTHIE",
        "name_ko": "스무디",
        "sort_order": 3,
        "items": [
            {"name": "오리지널 딸기 스무디", "price": 6000},
            {"name": "오리지널 망고 스무디", "price": 6000},
            {"name": "오리지널 블루베리 스무디", "price": 6000},
        ],
    },
    {
        "name_en": "DESSERT",
        "name_ko": "디저트",
        "sort_order": 4,
        "items": [
            {
                "name": "까치 마들렌",
                "note": "화이트 초코 + 다크 초코의 조합",
                "price": 2900,
                "is_representative": True,
            },
            {"name": "까치 브라우니", "price": 4500},
            {"name": "망고 소르베", "price": 3900, "is_representative": True},
            {"name": "딸기 소르베", "price": 3900},
        ],
    },
]

# ── home_signatures ───────────────────────────────────────────────────────
# menu_item_id 는 이름으로 찾아 연결합니다(시드 시점엔 id 를 모르므로).
# 가격은 여기 두지 않습니다 — FK 로 menu_items.price 를 참조하는 게 이 테이블의 존재 이유.
SIGNATURES = [
    {
        "menu_item_name": "까치 브라우니",
        "name_en": "Double Chocolate Brownie",
        "tagline": "매장에서 직접 만드는 꾸덕한 식감의\n수제 더블초코 브라우니",
        "sort_order": 1,
    },
    {
        "menu_item_name": "까치 마들렌",
        "name_en": "GGachi Madeleine",
        "tagline": "겉은 바삭, 속은 촉촉한\n까치커피바의 시그니처 마들렌",
        "sort_order": 2,
    },
    {
        "menu_item_name": "핸드드립 커피",
        "name_en": "Hand Drip Coffee",
        "tagline": "신선한 원두로 정성껏 내리는\n까치커피바의 핸드드립 커피",
        "sort_order": 3,
    },
]

# ── subscription_plans ────────────────────────────────────────────────────
PLANS = [
    {
        "code": "10",
        "name": "10일권",
        "original_price": 12000,
        "price": 10000,
        "duration_days": 10,
        "description": "아메리카노 410ML 매일 1잔",
        "badge": "BEST",
        "sort_order": 1,
    },
    {
        "code": "20",
        "name": "20일권",
        "original_price": 24000,
        "price": 19900,
        "duration_days": 20,
        "description": "아메리카노 410ML 매일 1잔",
        "badge": None,
        "sort_order": 2,
    },
    {
        "code": "30",
        "name": "30일권",
        "original_price": 36000,
        "price": 29700,
        "duration_days": 30,
        "description": "아메리카노 410ML 매일 1잔",
        "badge": "하루 990원",
        "sort_order": 3,
    },
]

# ── news ──────────────────────────────────────────────────────────────────
# body 는 Markdown, summary 는 목록/홈 카드에 뿌리는 한 줄 요약(디자인 카피 그대로).
NEWS = [
    {
        "title": "쫀득한 까치 브라우니 출시",
        "is_new": True,
        "views": 128,
        "published_at": datetime(2024, 6, 8),
        "summary": "매장에서 직접 만드는 수제 더블초코 브라우니가 새롭게 출시되었습니다.",
        "body": (
            "안녕하세요, 까치커피바입니다.\n\n"
            "매장에서 직접 만드는 수제 더블초코 브라우니가 새롭게 출시되었습니다. "
            "꾸덕하고 진한 초콜릿의 풍미와 쫀득한 식감을 그대로 담아, 커피 한 잔과 함께 "
            "즐기기 좋은 디저트로 준비했습니다.\n\n"
            "- 가격 : 4,500원\n"
            "- 판매 : 매장 한정 (소진 시 조기 마감될 수 있습니다)\n\n"
            "갓 구운 브라우니의 매력을 매장에서 만나보세요. 따뜻한 커피와 함께 특별한 시간 보내시길 바랍니다.\n\n"
            "— 까치커피바 드림"
        ),
    },
    {
        "title": "까치커피바 키링 굿즈 출시",
        "is_new": True,
        "views": 96,
        "published_at": datetime(2024, 6, 5),
        "summary": "까치커피바의 감성을 담은 키링이 새로 출시되었습니다.",
        # 디자인에 상세 본문이 없어 placeholder — 실제 내용 확정 후 교체 필요
        "body": "까치커피바의 감성을 담은 키링이 새로 출시되었습니다.\n\n(상세 내용 준비 중입니다.)",
    },
    {
        "title": "6월 매장 운영 안내",
        "is_new": False,
        "views": 210,
        "published_at": datetime(2024, 5, 28),
        "summary": "6월 운영 시간 및 휴무일정을 안내드립니다. 방문 전 확인 부탁드립니다.",
        # 디자인에 상세 본문이 없어 placeholder — 실제 내용 확정 후 교체 필요
        "body": "6월 운영 시간 및 휴무일정을 안내드립니다. 방문 전 확인 부탁드립니다.\n\n(상세 내용 준비 중입니다.)",
    },
]

# ── guide_items ───────────────────────────────────────────────────────────
# 화면은 sort_order 순으로 좌열 01·02·03 / 우열 04·05·06 으로 배치합니다.
GUIDE = [
    {"no": "01", "title": "운영 시간", "body": "월–토 08:00 – 20:00 · 일요일 12:00 – 20:00", "sort_order": 1},
    {
        "no": "02",
        "title": "포장 안내",
        "body": "모든 메뉴 포장 가능합니다.\n포장 시 500원 할인 혜택이 제공됩니다.",
        "sort_order": 2,
    },
    {
        "no": "03",
        "title": "결제 안내",
        "body": "모든 메뉴는 선결제입니다.\n현금, 카드, 간편결제 모두 가능합니다.",
        "sort_order": 3,
    },
    {
        "no": "04",
        "title": "매장 이용",
        "body": "1인 1음료 주문을 부탁드립니다.\n혼잡 시 이용 시간은 2시간으로 제한될 수 있습니다.",
        "sort_order": 4,
    },
    {"no": "05", "title": "와이파이", "body": "ID kkachicoffee · PW kkachibar123", "sort_order": 5},
    {
        "no": "06",
        "title": "반려동물 안내",
        "body": "반려동물 동반은 야외 좌석만 가능합니다.\n목줄 착용을 부탁드립니다.",
        "sort_order": 6,
    },
]


def seed_all():
    """비어 있는 콘텐츠 테이블에만 시드를 넣고, 테이블별 삽입 건수를 반환합니다."""
    from .extensions import db
    from .models import (
        GuideItem,
        HomeSignature,
        MenuCategory,
        MenuItem,
        News,
        StoreInfo,
        SubscriptionPlan,
    )

    inserted = {}

    if StoreInfo.query.count() == 0:
        db.session.add(StoreInfo(**STORE_INFO))
        inserted["store_info"] = 1

    if MenuCategory.query.count() == 0:
        item_count = 0
        for cat in MENU:
            category = MenuCategory(
                name_en=cat["name_en"], name_ko=cat["name_ko"], sort_order=cat["sort_order"]
            )
            for i, item in enumerate(cat["items"], start=1):
                category.items.append(MenuItem(sort_order=i, **item))
                item_count += 1
            db.session.add(category)
        inserted["menu_categories"] = len(MENU)
        inserted["menu_items"] = item_count
        # home_signatures 가 menu_items.id 를 참조하므로 먼저 flush 해서 id 를 확정합니다.
        db.session.flush()

    if HomeSignature.query.count() == 0:
        for sig in SIGNATURES:
            item = MenuItem.query.filter_by(name=sig["menu_item_name"]).first()
            if item is None:
                # 메뉴가 없으면 큐레이션도 성립하지 않으므로 조용히 건너뜁니다.
                continue
            db.session.add(
                HomeSignature(
                    menu_item_id=item.id,
                    name_en=sig["name_en"],
                    tagline=sig["tagline"],
                    sort_order=sig["sort_order"],
                )
            )
            inserted["home_signatures"] = inserted.get("home_signatures", 0) + 1

    if SubscriptionPlan.query.count() == 0:
        for plan in PLANS:
            db.session.add(SubscriptionPlan(**plan))
        inserted["subscription_plans"] = len(PLANS)

    if News.query.count() == 0:
        for item in NEWS:
            db.session.add(News(category="공지", author="까치커피바", **item))
        inserted["news"] = len(NEWS)

    if GuideItem.query.count() == 0:
        for item in GUIDE:
            db.session.add(GuideItem(**item))
        inserted["guide_items"] = len(GUIDE)

    db.session.commit()
    return inserted
