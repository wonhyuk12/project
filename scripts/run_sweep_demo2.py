"""Finer sweep of mean_reversion's drawdown_min_pct, extending toward -0.25.
Reuses already-logged -0.10/-0.15/-0.20 results instead of recomputing them.
"""

import io
import logging
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import pandas as pd

from stock_backtest.attempt_log import load_attempts
from stock_backtest.backtest import trading_calendar
from stock_backtest.config import load_backtest_config, load_signal_config
from stock_backtest.data_loader import load_universe
from stock_backtest.sweep import check_stability, sweep_1d

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

sig_cfg = load_signal_config()
bt_cfg = load_backtest_config()

t0 = time.time()
universe = load_universe(end="2023-12-31")
print(f"universe loaded: {len(universe)} rows in {time.time()-t0:.1f}s", flush=True)
calendar = trading_calendar(universe)

base_params = sig_cfg["mean_reversion"]
new_values = [-0.175, -0.225, -0.25]

result = sweep_1d(
    strategy_name="mean_reversion",
    base_params=base_params,
    param_name="drawdown_min_pct",
    values=new_values,
    universe=universe,
    calendar=calendar,
    start="2018-01-01",
    end="2023-12-31",
    holding_period_days=bt_cfg["holding_period_days"],
    cost_params=bt_cfg["costs"],
)

# splice in the already-logged -0.10/-0.15/-0.20 points rather than rerunning them
attempts = load_attempts("mean_reversion")
cached_rows = []
seen = set()
for a in attempts:
    v = a["params"].get("drawdown_min_pct")
    if v in (-0.10, -0.15, -0.20) and v not in seen and a["period"]["start"] == "2018-01-01" and a["period"]["end"] == "2023-12-31":
        cached_rows.append({"drawdown_min_pct": v, **a["metrics"]})
        seen.add(v)

result = pd.concat([result, pd.DataFrame(cached_rows)], ignore_index=True)
result = result.drop_duplicates(subset="drawdown_min_pct").sort_values("drawdown_min_pct").reset_index(drop=True)

print("\n=== sweep result (full) ===", flush=True)
print(result.to_string(), flush=True)

print("\n=== stability check ===", flush=True)
for w in check_stability(result, "drawdown_min_pct", "mean_return"):
    print(w, flush=True)
