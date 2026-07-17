"""API 엔드포인트.

설계 원칙:
- DB가 아직 설정되지 않아도(=Supabase .env 미입력) 앱은 뜨고, /health 는 동작합니다.
- 콘텐츠 엔드포인트는 DB가 원천이므로 미설정 시 503과 안내 메시지를 반환합니다.
  이때 프론트는 화면이 비지 않도록 자체 폴백 데이터로 렌더링합니다(src/data/fallback.js).
- 가격은 정수(원) 그대로 응답합니다. "5,500원" 포맷은 화면(UI) 담당.
"""
from datetime import date, timedelta

from flask import Blueprint, current_app, jsonify, request

from ..extensions import db

bp = Blueprint("api", __name__, url_prefix="/api")

PAY_METHODS = {"kakao", "toss", "card"}


def _db_ready():
    return bool(current_app.config.get("DATABASE_CONFIGURED"))


def _db_not_configured():
    return (
        jsonify(error="데이터베이스가 아직 설정되지 않았습니다. backend/.env 를 채운 뒤 다시 시도하세요."),
        503,
    )


@bp.get("/health")
def health():
    """서버 상태 + DB 설정 여부."""
    return jsonify(status="ok", databaseConfigured=_db_ready())


@bp.get("/store-info")
def get_store_info():
    """매장 기본 정보 — 헤더/푸터."""
    if not _db_ready():
        return _db_not_configured()
    from ..models import StoreInfo

    info = StoreInfo.query.order_by(StoreInfo.id).first()
    if info is None:
        return jsonify(error="매장 정보가 아직 등록되지 않았습니다."), 404
    return jsonify(info.to_dict())


@bp.get("/menu")
def get_menu():
    """전체 메뉴 — 카테고리별로 항목을 묶어 정렬 순서대로 반환."""
    if not _db_ready():
        return _db_not_configured()
    from ..models import MenuCategory

    categories = MenuCategory.query.order_by(MenuCategory.sort_order).all()
    return jsonify([c.to_dict() for c in categories])


@bp.get("/signatures")
def get_signatures():
    """홈 Signature 카드 — 가격은 FK 로 연결된 menu_items 에서 가져옵니다."""
    if not _db_ready():
        return _db_not_configured()
    from ..models import HomeSignature

    items = HomeSignature.query.order_by(HomeSignature.sort_order).all()
    # 카드의 '01' '02' '03' 번호는 저장값이 아니라 정렬 순서에서 파생됩니다.
    return jsonify(
        [{**s.to_dict(), "no": f"{i:02d}"} for i, s in enumerate(items, start=1)]
    )


@bp.get("/plans")
def get_plans():
    """정기구독 플랜 — 판매 중(is_active)인 것만."""
    if not _db_ready():
        return _db_not_configured()
    from ..models import SubscriptionPlan

    plans = (
        SubscriptionPlan.query.filter_by(is_active=True)
        .order_by(SubscriptionPlan.sort_order)
        .all()
    )
    return jsonify([p.to_dict() for p in plans])


@bp.get("/news")
def list_news():
    """소식 목록 (최신순)."""
    if not _db_ready():
        return _db_not_configured()
    from ..models import News

    items = News.query.order_by(News.published_at.desc()).all()
    return jsonify([n.to_dict() for n in items])


@bp.get("/news/<int:news_id>")
def get_news(news_id):
    """소식 상세 — 조회할 때마다 views 를 1 증가시킵니다."""
    if not _db_ready():
        return _db_not_configured()
    from ..models import News

    item = db.session.get(News, news_id)
    if item is None:
        return jsonify(error="존재하지 않는 글입니다."), 404

    # 동시 요청에서도 유실되지 않도록 파이썬이 아닌 DB 에서 증가시킵니다.
    News.query.filter_by(id=news_id).update({News.views: News.views + 1})
    db.session.commit()
    db.session.refresh(item)

    return jsonify(item.to_dict(with_body=True))


@bp.get("/guide")
def get_guide():
    """이용안내 항목 01~06."""
    if not _db_ready():
        return _db_not_configured()
    from ..models import GuideItem

    items = GuideItem.query.order_by(GuideItem.sort_order).all()
    return jsonify([g.to_dict() for g in items])


@bp.post("/subscriptions")
def create_subscription():
    """정기구독 신청 저장.

    금액은 요청 값을 믿지 않고 서버가 플랜에서 읽어 스냅샷으로 저장합니다.
    """
    if not _db_ready():
        return _db_not_configured()
    from ..models import Subscription, SubscriptionPlan

    data = request.get_json(silent=True) or {}
    plan_code = str(data.get("planCode", "") or "")
    plan = SubscriptionPlan.query.filter_by(code=plan_code, is_active=True).first()
    if plan is None:
        return jsonify(error="올바르지 않은 planCode 입니다."), 400

    pay_method = data.get("payMethod")
    if pay_method not in PAY_METHODS:
        return jsonify(error="올바르지 않은 payMethod 입니다. (kakao | toss | card)"), 400

    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    if not name or not phone:
        return jsonify(error="이름과 연락처를 입력해주세요."), 400

    start = date.today()
    sub = Subscription(
        plan_id=plan.id,
        customer_name=name,
        customer_phone=phone,
        pay_method=pay_method,
        amount=plan.price,  # 신청 시점 금액 스냅샷
        status="pending",
        start_date=start,
        end_date=start + timedelta(days=plan.duration_days),
    )
    db.session.add(sub)
    db.session.commit()
    return jsonify(sub.to_dict()), 201
