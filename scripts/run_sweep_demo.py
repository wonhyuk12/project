"""Demo of the parameter-stability sweep: mean_reversion's drawdown_min_pct
around its default (-0.15), full 2018-2023 experimental period.
"""

import logging
import time

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
# -0.15 (the default) was already run and logged as the baseline attempt;
# only compute the two new neighbors here and splice the cached baseline in,
# rather than paying for an ~8min rerun of a config we already have.
new_values = [-0.10, -0.20]

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

import pandas as pd
baseline_trades = pd.read_parquet("data/results/trades_mean_reversion_2018-01-01_2023-12-31.parquet")
from stock_backtest.sweep import summarize_fast
baseline_row = {"drawdown_min_pct": -0.15, **summarize_fast(baseline_trades)}
result = pd.concat([result, pd.DataFrame([baseline_row])], ignore_index=True)
result = result.sort_values("drawdown_min_pct").reset_index(drop=True)

print("\n=== sweep result ===", flush=True)
print(result.to_string(), flush=True)

print("\n=== stability check ===", flush=True)
for w in check_stability(result, "drawdown_min_pct", "mean_return"):
    print(w, flush=True)
