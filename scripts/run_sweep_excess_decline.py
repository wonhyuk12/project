import io
import logging
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import pandas as pd

from stock_backtest.backtest import run_backtest, trading_calendar
from stock_backtest.config import load_backtest_config, load_signal_config
from stock_backtest.data_loader import load_universe
from stock_backtest.attempt_log import log_attempt
from stock_backtest.sweep import summarize_fast, check_stability

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

sig_cfg = load_signal_config()
bt_cfg = load_backtest_config()

START, END = "2018-01-01", "2023-12-31"

t0 = time.time()
universe = load_universe(end=END)
print(f"universe loaded: {len(universe)} rows in {time.time()-t0:.1f}s", flush=True)
calendar = trading_calendar(universe)

base_params = dict(sig_cfg["mean_reversion"])
base_params["drawdown_min_pct"] = -0.25  # best value found in the earlier sweep

values = [-0.0005, -0.005, -0.05, -0.10, -0.15, -0.20]

rows = []
for v in values:
    params = dict(base_params)
    params["excess_decline_min_pct"] = v
    t0 = time.time()
    trades = run_backtest(
        "mean_reversion", universe, calendar, START, END, params,
        bt_cfg["holding_period_days"], bt_cfg["costs"],
    )
    metrics_all = summarize_fast(trades)
    trades_ex2020 = trades[trades["signal_date"].dt.year != 2020]
    metrics_ex2020 = summarize_fast(trades_ex2020)
    log_attempt("mean_reversion", params, {"start": START, "end": END}, metrics_all)
    print(f"excess_decline_min_pct={v} took {time.time()-t0:.1f}s -> all={metrics_all} ex2020={metrics_ex2020}", flush=True)
    rows.append({
        "excess_decline_min_pct": v,
        "n_trades": metrics_all["n_trades"],
        "mean_return_all": metrics_all["mean_return"],
        "win_rate_all": metrics_all["win_rate"],
        "mean_return_ex2020": metrics_ex2020["mean_return"],
        "win_rate_ex2020": metrics_ex2020["win_rate"],
    })

result = pd.DataFrame(rows)
print("\n=== sweep result ===", flush=True)
print(result.to_string(), flush=True)

print("\n=== stability (all years) ===", flush=True)
for w in check_stability(result.rename(columns={"mean_return_all": "mean_return"}), "excess_decline_min_pct", "mean_return"):
    print(w, flush=True)

print("\n=== stability (ex-2020) ===", flush=True)
for w in check_stability(result.rename(columns={"mean_return_ex2020": "mean_return"}), "excess_decline_min_pct", "mean_return"):
    print(w, flush=True)
