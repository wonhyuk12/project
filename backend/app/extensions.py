"""Flask 확장 객체 — 순환 import 방지를 위해 별도 모듈로 분리."""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
