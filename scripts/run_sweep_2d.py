"""2D grid: drawdown_min_pct x volume_spike_multiplier, mean_reversion,
2018-2023. Checks whether the drawdown_min_pct ranking (-0.20 beating -0.15
at the default multiplier=3.0) holds up under other multiplier settings, or
is itself an artifact of that one fixed default.

The multiplier=3.0 column is spliced in from already-logged runs instead of
recomputed.
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
from stock_backtest.sweep import sweep_2d

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

sig_cfg = load_signal_config()
bt_cfg = load_backtest_config()

t0 = time.time()
universe = load_universe(end="2023-12-31")
print(f"universe loaded: {len(universe)} rows in {time.time()-t0:.1f}s", flush=True)
calendar = trading_calendar(universe)

base_params = sig_cfg["mean_reversion"]
dd_values = [-0.10, -0.15, -0.20, -0.25]
vol_values = [2.0, 3.0, 4.0, 5.0]

# splice in the multiplier=3.0 column from already-logged single-param sweep runs
attempts = load_attempts("mean_reversion")
cached = {}
for a in attempts:
    p = a["params"]
    if (
        p.get("volume_spike_multiplier") == 3.0
        and p.get("drawdown_min_pct") in dd_values
        and a["period"]["start"] == "2018-01-01"
        and a["period"]["end"] == "2023-12-31"
    ):
        cached[(p["drawdown_min_pct"], 3.0)] = a["metrics"]

print(f"spliced {len(cached)} cached combos for multiplier=3.0", flush=True)

result = sweep_2d(
    strategy_name="mean_reversion",
    base_params=base_params,
    param_a="drawdown_min_pct",
    values_a=dd_values,
    param_b="volume_spike_multiplier",
    values_b=vol_values,
    universe=universe,
    calendar=calendar,
    start="2018-01-01",
    end="2023-12-31",
    holding_period_days=bt_cfg["holding_period_days"],
    cost_params=bt_cfg["costs"],
    skip_combos=set(cached.keys()),
)

cached_rows = [
    {"drawdown_min_pct": dd, "volume_spike_multiplier": mult, **metrics}
    for (dd, mult), metrics in cached.items()
]
result = pd.concat([result, pd.DataFrame(cached_rows)], ignore_index=True)
result = result.sort_values(["volume_spike_multiplier", "drawdown_min_pct"]).reset_index(drop=True)

print("\n=== 2D grid result ===", flush=True)
print(result.to_string(), flush=True)

pivot = result.pivot(index="drawdown_min_pct", columns="volume_spike_multiplier", values="mean_return")
print("\n=== mean_return pivot (rows=drawdown_min_pct, cols=volume_spike_multiplier) ===", flush=True)
print(pivot.to_string(), flush=True)

print("\n=== best drawdown_min_pct per multiplier column ===", flush=True)
print(pivot.idxmax().to_string(), flush=True)
