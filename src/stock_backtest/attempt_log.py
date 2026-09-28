"""Append-only log of every parameter combination ever backtested.

Exists so a result can always be reported as "총 N개 조합 중 상위 M위"
instead of presented as if it were the only thing tried.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

DEFAULT_LOG_PATH = Path("logs/experiment_attempts.jsonl")


def log_attempt(
    strategy: str,
    params: dict,
    period: dict,
    metrics: dict,
    log_path: Path = DEFAULT_LOG_PATH,
) -> dict:
    record = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "strategy": strategy,
        "params": params,
        "period": period,
        "metrics": metrics,
    }
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record


def load_attempts(strategy: str | None = None, log_path: Path = DEFAULT_LOG_PATH) -> list[dict]:
    if not log_path.exists():
        return []
    records = [
        json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines() if line.strip()
    ]
    if strategy is not None:
        records = [r for r in records if r["strategy"] == strategy]
    return records


def rank_description(
    strategy: str,
    metric: str,
    current_value: float,
    higher_is_better: bool = True,
    log_path: Path = DEFAULT_LOG_PATH,
) -> str:
    """'총 N개 조합 중 상위 M위' -- for the results report, not for picking a winner."""
    records = load_attempts(strategy, log_path)
    values = [r["metrics"].get(metric) for r in records if r["metrics"].get(metric) is not None]
    n = len(values)
    if n == 0:
        return "이 전략으로는 첫 시도 (비교 대상 없음)"
    ranked = sorted(values, reverse=higher_is_better)
    try:
        rank = ranked.index(current_value) + 1
    except ValueError:
        rank = sum(1 for v in ranked if (v > current_value if higher_is_better else v < current_value)) + 1
    return f"총 {n}개 조합 중 상위 {rank}위"
