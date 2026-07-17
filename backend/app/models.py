"""데이터베이스 모델 (SQLAlchemy) — SCHEMA.md 의 DDL과 1:1로 대응합니다.

주의:
- 이 모듈을 import 하는 것만으로는 DB에 접속하지 않습니다.
  실제 접속은 db.init_app(app) 이후, 쿼리를 실행할 때 이루어집니다.
- 스키마의 원천(single source of truth)은 SCHEMA.md 의 DDL 입니다.
  Supabase 에 DDL 을 이미 실행했다면 init-db 의 create_all 은 아무 것도 하지 않습니다.
- 가격은 정수(원)로만 저장합니다. "5,500원" 같은 포맷은 화면(UI) 담당입니다.
"""
from datetime import datetime

from sqlalchemy import CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID

from .extensions import db


# ── 콘텐츠 ────────────────────────────────────────────────────────────────

class StoreInfo(db.Model):
    """매장 기본 정보 — 헤더/푸터에서 공유하는 단일 행 테이블."""
    __tablename__ = "store_info"
    __table_args__ = (CheckConstraint("id = 1", name="store_info_single_row"),)

    id = db.Column(db.BigInteger, primary_key=True)
    brand_name_ko = db.Column(db.Text, nullable=False, default="까치커피바")
    brand_name_en = db.Column(db.Text, nullable=False, default="GGACHI COFFEE BAR")
    phone = db.Column(db.Text)
    address = db.Column(db.Text)
    opening_hours = db.Column(db.Text)
    instagram = db.Column(db.Text)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "brandNameKo": self.brand_name_ko,
            "brandNameEn": self.brand_name_en,
            "phone": self.phone,
            "address": self.address,
            "openingHours": self.opening_hours,
            "instagram": self.instagram,
        }


class MenuCategory(db.Model):
    """메뉴 카테고리 — COFFEE / LATTE / SMOOTHIE / DESSERT."""
    __tablename__ = "menu_categories"

    id = db.Column(db.BigInteger, primary_key=True)
    name_en = db.Column(db.Text, nullable=False)
    name_ko = db.Column(db.Text, nullable=False)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    items = db.relationship(
        "MenuItem",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="MenuItem.sort_order",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "nameEn": self.name_en,
            "nameKo": self.name_ko,
            "items": [i.to_dict() for i in self.items],
        }


class MenuItem(db.Model):
    """메뉴 항목 — 모든 메뉴 정보의 원천 데이터."""
    __tablename__ = "menu_items"
    __table_args__ = (CheckConstraint("price >= 0", name="menu_items_price_check"),)

    id = db.Column(db.BigInteger, primary_key=True)
    category_id = db.Column(
        db.BigInteger, db.ForeignKey("menu_categories.id", ondelete="CASCADE"), nullable=False
    )
    name = db.Column(db.Text, nullable=False)
    note = db.Column(db.Text)
    price = db.Column(db.Integer, nullable=False)
    is_representative = db.Column(db.Boolean, nullable=False, default=False)
    is_sold_out = db.Column(db.Boolean, nullable=False, default=False)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    category = db.relationship("MenuCategory", back_populates="items")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "note": self.note,
            "price": self.price,
            "isRepresentative": self.is_representative,
            "isSoldOut": self.is_sold_out,
        }


class HomeSignature(db.Model):
    """홈 Signature 큐레이션 — 메뉴 원천 데이터와 분리된 마케팅 큐레이션."""
    __tablename__ = "home_signatures"

    id = db.Column(db.BigInteger, primary_key=True)
    menu_item_id = db.Column(
        db.BigInteger, db.ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False
    )
    name_en = db.Column(db.Text, nullable=False)
    tagline = db.Column(db.Text)
    image_url = db.Column(db.Text)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    menu_item = db.relationship("MenuItem")

    def to_dict(self):
        return {
            "id": self.id,
            "menuItemId": self.menu_item_id,
            "nameEn": self.name_en,
            # 카드 설명은 줄바꿈으로 나뉘고, 화면은 줄 단위로 렌더링합니다.
            "tagline": (self.tagline or "").split("\n"),
            "imageUrl": self.image_url,
            # 가격은 큐레이션이 아니라 원본 메뉴의 값 — FK 를 타고 가져옵니다.
            "price": self.menu_item.price if self.menu_item else None,
        }


class SubscriptionPlan(db.Model):
    """정기구독 플랜 — 10 / 20 / 30일권."""
    __tablename__ = "subscription_plans"

    id = db.Column(db.BigInteger, primary_key=True)
    code = db.Column(db.Text, nullable=False, unique=True)
    name = db.Column(db.Text, nullable=False)
    original_price = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Integer, nullable=False)
    duration_days = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    badge = db.Column(db.Text)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "originalPrice": self.original_price,
            "price": self.price,
            "durationDays": self.duration_days,
            "description": self.description,
            "badge": self.badge,
        }


class Subscription(db.Model):
    """정기구독 신청 — 고객이 쓰는(write) 유일한 콘텐츠 테이블."""
    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint(
            "pay_method in ('kakao','toss','card')", name="subscriptions_pay_method_check"
        ),
        CheckConstraint(
            "status in ('pending','paid','active','expired','canceled')",
            name="subscriptions_status_check",
        ),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    plan_id = db.Column(db.BigInteger, db.ForeignKey("subscription_plans.id"), nullable=False)
    customer_name = db.Column(db.Text)
    customer_phone = db.Column(db.Text)
    pay_method = db.Column(db.Text)
    # 신청 시점 금액 스냅샷 — 플랜 가격이 바뀌어도 과거 기록은 불변.
    amount = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Text, nullable=False, default="pending")
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    # 방문 세션 연결(전환 분석용). 행동 로그 수집 전에는 항상 null.
    session_id = db.Column(UUID(as_uuid=True), db.ForeignKey("analytics_sessions.id"))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    plan = db.relationship("SubscriptionPlan")

    def to_dict(self):
        # 이름·연락처(PII)는 응답에 포함하지 않습니다.
        return {
            "id": self.id,
            "planId": self.plan_id,
            "planCode": self.plan.code if self.plan else None,
            "payMethod": self.pay_method,
            "amount": self.amount,
            "status": self.status,
            "startDate": self.start_date.isoformat() if self.start_date else None,
            "endDate": self.end_date.isoformat() if self.end_date else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class News(db.Model):
    """소식(공지) — body 는 Markdown."""
    __tablename__ = "news"

    id = db.Column(db.BigInteger, primary_key=True)
    category = db.Column(db.Text, nullable=False, default="공지")
    title = db.Column(db.Text, nullable=False)
    is_new = db.Column(db.Boolean, nullable=False, default=False)
    author = db.Column(db.Text, nullable=False, default="까치커피바")
    # 목록/홈 카드용 한 줄 요약. 본문에서 파생하지 않고 별도 콘텐츠로 관리합니다.
    summary = db.Column(db.Text, nullable=False, default="")
    body = db.Column(db.Text, nullable=False, default="")
    image_url = db.Column(db.Text)
    views = db.Column(db.Integer, nullable=False, default=0)
    published_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    def to_dict(self, with_body=False):
        data = {
            "id": self.id,
            "category": self.category,
            "title": self.title,
            "isNew": self.is_new,
            "author": self.author,
            "summary": self.summary,
            "imageUrl": self.image_url,
            "views": self.views,
            "publishedAt": self.published_at.isoformat() if self.published_at else None,
        }
        # 본문은 상세 화면에서만 필요하므로 목록 응답에는 싣지 않습니다.
        if with_body:
            data["body"] = self.body
        return data


class GuideItem(db.Model):
    """이용안내 항목 — 홈 Guide 섹션의 01~06."""
    __tablename__ = "guide_items"

    id = db.Column(db.BigInteger, primary_key=True)
    no = db.Column(db.Text, nullable=False)
    title = db.Column(db.Text, nullable=False)
    body = db.Column(db.Text, nullable=False)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "no": self.no,
            "title": self.title,
            # 안내문은 줄바꿈으로 나뉘고, 화면은 줄 단위로 렌더링합니다.
            "body": self.body.split("\n"),
        }


# ── 분석(행동 로그) ────────────────────────────────────────────────────────
# 수집(이벤트 전송)은 아직 붙이지 않았지만, subscriptions.session_id 가 이 테이블을
# 참조하므로 모델을 함께 정의해 FK 해석과 create_all 이 가능하도록 합니다.

class AnalyticsSession(db.Model):
    """방문 세션 (익명 방문자 단위)."""
    __tablename__ = "analytics_sessions"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=db.text("gen_random_uuid()"))
    anonymous_id = db.Column(db.Text, nullable=False)
    referrer = db.Column(db.Text)
    landing_path = db.Column(db.Text)
    device = db.Column(db.Text)
    browser = db.Column(db.Text)
    os = db.Column(db.Text)
    utm_source = db.Column(db.Text)
    utm_medium = db.Column(db.Text)
    utm_campaign = db.Column(db.Text)
    started_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime(timezone=True))


class AnalyticsEvent(db.Model):
    """행동 로그 (클릭스트림) — append-only."""
    __tablename__ = "analytics_events"

    id = db.Column(db.BigInteger, primary_key=True)
    session_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey("analytics_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    anonymous_id = db.Column(db.Text, nullable=False)
    event_type = db.Column(db.Text, nullable=False)
    page_name = db.Column(db.Text)
    path = db.Column(db.Text)
    referrer_path = db.Column(db.Text)
    news_id = db.Column(db.BigInteger, db.ForeignKey("news.id", ondelete="SET NULL"))
    plan_id = db.Column(db.BigInteger, db.ForeignKey("subscription_plans.id", ondelete="SET NULL"))
    menu_item_id = db.Column(db.BigInteger, db.ForeignKey("menu_items.id", ondelete="SET NULL"))
    properties = db.Column(JSONB, nullable=False, default=dict)
    occurred_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)
