"""Neighboring-parameter stability sweep.

The point isn't finding the best value -- it's checking whether performance
holds up across a neighborhood of values. A value that only looks good in
isolation, with neighbors on both sides falling apart or flipping sign, is
very likely fit to noise rather than a real edge.

Uses summarize_fast() (no MDD) because MDD's per-trade daily mark-to-market
pass is the slowest part of reporting and isn't needed to compare a sweep's
relative shape -- run report.summarize() separately on whichever single
config you end up keeping.
"""

from __future__ import annotations

import logging

import pandas as pd

from stock_backtest.attempt_log import log_attempt
from stock_backtest.backtest import run_backtest

logger = logging.getLogger(__name__)


def summarize_fast(trades: pd.DataFrame) -> dict:
    if trades.empty:
        return {"n_trades": 0, "mean_return": None, "median_return": None, "win_rate": None}
    return {
        "n_trades": len(trades),
        "mean_return": trades["net_return"].mean(),
        "median_return": trades["net_return"].median(),
        "win_rate": (trades["net_return"] > 0).mean(),
    }


def sweep_1d(
    strategy_name: str,
    base_params: dict,
    param_name: str,
    values: list,
    universe: pd.DataFrame,
    calendar: pd.DatetimeIndex,
    start: str,
    end: str,
    holding_period_days: int,
    cost_params: dict,
) -> pd.DataFrame:
    rows = []
    for v in values:
        params = dict(base_params)
        params[param_name] = v
        trades = run_backtest(
            strategy_name, universe, calendar, start, end, params, holding_period_days, cost_params
        )
        metrics = summarize_fast(trades)
        log_attempt(strategy_name, params, {"start": start, "end": end}, metrics)
        logger.info("%s=%s -> %s", param_name, v, metrics)
        rows.append({param_name: v, **metrics})
    return pd.DataFrame(rows)


def sweep_2d(
    strategy_name: str,
    base_params: dict,
    param_a: str,
    values_a: list,
    param_b: str,
    values_b: list,
    universe: pd.DataFrame,
    calendar: pd.DatetimeIndex,
    start: str,
    end: str,
    holding_period_days: int,
    cost_params: dict,
    skip_combos: set[tuple] | None = None,
) -> pd.DataFrame:
    """Full grid over (param_a, param_b) -- checks for interaction effects a
    1D sweep can't see, at combinatorial cost. skip_combos lets you splice in
    already-logged runs instead of recomputing them."""
    skip_combos = skip_combos or set()
    rows = []
    for a in values_a:
        for b in values_b:
            if (a, b) in skip_combos:
                continue
            params = dict(base_params)
            params[param_a] = a
            params[param_b] = b
            trades = run_backtest(
                strategy_name, universe, calendar, start, end, params, holding_period_days, cost_params
            )
            metrics = summarize_fast(trades)
            log_attempt(strategy_name, params, {"start": start, "end": end}, metrics)
            logger.info("%s=%s, %s=%s -> %s", param_a, a, param_b, b, metrics)
            rows.append({param_a: a, param_b: b, **metrics})
    return pd.DataFrame(rows)


def check_stability(sweep_df: pd.DataFrame, param_name: str, metric: str = "mean_return") -> list[str]:
    """Flags: sign flips between neighbors, or a value that swings much
    further from its neighbors than they do from each other."""
    warnings = []
    vals = sweep_df[metric].tolist()
    params = sweep_df[param_name].tolist()

    for i in range(len(vals)):
        if vals[i] is None:
            continue
        neighbors = [vals[j] for j in (i - 1, i + 1) if 0 <= j < len(vals) and vals[j] is not None]
        if not neighbors:
            continue
        if any((vals[i] > 0) != (n > 0) for n in neighbors):
            warnings.append(
                f"⚠ {param_name}={params[i]}: 이웃값과 부호가 다름 "
                f"({metric}={vals[i]:.4f} vs 이웃 {neighbors})"
            )

    if len(vals) >= 3:
        diffs = [abs(vals[i] - vals[i - 1]) for i in range(1, len(vals)) if vals[i] is not None and vals[i - 1] is not None]
        if diffs:
            avg_step = sum(diffs) / len(diffs)
            for i, d in enumerate(diffs, start=1):
                if avg_step > 0 and d > 3 * avg_step:
                    warnings.append(
                        f"⚠ {param_name}={params[i-1]}→{params[i]} 구간에서 "
                        f"{metric} 변화가 평균 대비 급격함 (급변={d:.4f}, 평균스텝={avg_step:.4f})"
                    )

    if not warnings:
        warnings.append(f"이웃값 사이에서 {metric} 부호/급변 이상 없음")
    return warnings
