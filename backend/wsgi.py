"""실행 진입점.

개발 실행:   python wsgi.py
또는:        flask --app wsgi run --port 5000
DB 초기화:   flask --app wsgi init-db
"""
import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
