"""데이터베이스 모델 (SQLAlchemy).

주의: 이 모듈을 import 하는 것만으로는 DB에 접속하지 않습니다.
실제 접속은 db.init_app(app) 이후, 쿼리를 실행할 때 이루어집니다.
"""
from datetime import datetime

from .extensions import db


class News(db.Model):
    """소식(공지) 게시글 — 프론트 data/news.js 와 대응됩니다."""
    __tablename__ = "news"

    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(20), nullable=False, default="공지")
    title = db.Column(db.String(200), nullable=False)
    is_new = db.Column(db.Boolean, nullable=False, default=False)
    author = db.Column(db.String(50), nullable=False, default="까치커피바")
    body = db.Column(db.Text, nullable=False, default="")
    views = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "category": self.category,
            "title": self.title,
            "isNew": self.is_new,
            "author": self.author,
            "body": self.body,
            "views": self.views,
            "date": self.created_at.strftime("%Y.%m.%d") if self.created_at else None,
        }


class Subscription(db.Model):
    """정기구독 신청 (데모 폼 제출 저장용)."""
    __tablename__ = "subscriptions"

    id = db.Column(db.Integer, primary_key=True)
    plan_id = db.Column(db.String(10), nullable=False)   # '10' | '20' | '30'
    name = db.Column(db.String(50))
    phone = db.Column(db.String(30))
    pay_method = db.Column(db.String(20))                # 'kakao' | 'toss' | 'card'
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "planId": self.plan_id,
            "name": self.name,
            "phone": self.phone,
            "payMethod": self.pay_method,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
