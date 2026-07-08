"""API 엔드포인트.

설계 원칙:
- DB가 아직 설정되지 않아도(=Supabase .env 미입력) 앱은 뜨고,
  DB가 필요 없는 엔드포인트(/health, /plans)는 정상 동작합니다.
- DB가 필요한 엔드포인트(/news, /subscriptions)는 미설정 시 503과 안내 메시지를 반환합니다.
"""
from flask import Blueprint, jsonify, request, current_app

from ..extensions import db

bp = Blueprint("api", __name__, url_prefix="/api")

# 정기구독 플랜 — 프론트 data/plans.js 와 동일 (DB 불필요한 정적 데이터)
PLANS = [
    {"id": "10", "name": "10일권", "was": "12,000원", "price": "10,000원", "priceValue": 10000},
    {"id": "20", "name": "20일권", "was": "24,000원", "price": "19,900원", "priceValue": 19900},
    {"id": "30", "name": "30일권", "was": "36,000원", "price": "29,700원", "priceValue": 29700},
]
_PLAN_IDS = {p["id"] for p in PLANS}


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


@bp.get("/plans")
def get_plans():
    """정기구독 플랜 목록 (정적)."""
    return jsonify(PLANS)


@bp.get("/news")
def list_news():
    """소식 목록."""
    if not _db_ready():
        return _db_not_configured()
    from ..models import News
    items = News.query.order_by(News.created_at.desc()).all()
    return jsonify([n.to_dict() for n in items])


@bp.get("/news/<int:news_id>")
def get_news(news_id):
    """소식 상세."""
    if not _db_ready():
        return _db_not_configured()
    from ..models import News
    item = db.session.get(News, news_id)
    if item is None:
        return jsonify(error="존재하지 않는 글입니다."), 404
    return jsonify(item.to_dict())


@bp.post("/subscriptions")
def create_subscription():
    """정기구독 신청 저장 (데모)."""
    data = request.get_json(silent=True) or {}
    plan_id = str(data.get("planId", ""))
    if plan_id not in _PLAN_IDS:
        return jsonify(error="올바르지 않은 planId 입니다. (10 | 20 | 30)"), 400

    if not _db_ready():
        return _db_not_configured()

    from ..models import Subscription
    sub = Subscription(
        plan_id=plan_id,
        name=data.get("name"),
        phone=data.get("phone"),
        pay_method=data.get("payMethod"),
    )
    db.session.add(sub)
    db.session.commit()
    return jsonify(sub.to_dict()), 201
