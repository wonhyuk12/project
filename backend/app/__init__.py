"""Flask 애플리케이션 팩토리."""
import click
from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from .extensions import db


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # 프론트(Vite)에서의 요청 허용
    CORS(app, origins=app.config["CORS_ORIGINS"])

    # DB가 설정된 경우에만 SQLAlchemy 를 바인딩합니다.
    # (미설정이어도 앱은 정상 기동 — 프론트 단독 실행에 영향 없음)
    if app.config["SQLALCHEMY_DATABASE_URI"]:
        db.init_app(app)

    # 라우트 등록
    from .api import bp as api_bp
    app.register_blueprint(api_bp)

    @app.get("/")
    def index():
        return jsonify(
            service="ggachi-coffee-bar-backend",
            databaseConfigured=app.config["DATABASE_CONFIGURED"],
            endpoints=["/api/health", "/api/plans", "/api/news", "/api/news/<id>", "/api/subscriptions"],
        )

    _register_cli(app)
    return app


def _register_cli(app):
    @app.cli.command("init-db")
    def init_db():
        """DB에 테이블 생성 + 시드 데이터 삽입. (backend/.env 설정 후 실행)"""
        if not app.config["SQLALCHEMY_DATABASE_URI"]:
            click.echo("DB가 설정되지 않았습니다. 먼저 backend/.env 를 채우세요.")
            return
        # 모델을 import 해야 create_all 이 테이블을 인식합니다.
        from . import models  # noqa: F401
        from .seed import seed_news

        db.create_all()
        inserted = seed_news()
        click.echo(f"테이블 생성 완료. 시드 소식 {inserted}건 삽입.")
