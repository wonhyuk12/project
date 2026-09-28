import io
import logging
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import pandas as pd

from stock_backtest.attempt_log import log_attempt
from stock_backtest.backtest import run_backtest, trading_calendar
from stock_backtest.config import load_backtest_config, load_signal_config
from stock_backtest.data_loader import load_universe
from stock_backtest.sweep import summarize_fast

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

sig_cfg = load_signal_config()
bt_cfg = load_backtest_config()
START, END = "2018-01-01", "2023-12-31"

t0 = time.time()
universe = load_universe(end=END)
print(f"universe loaded: {len(universe)} rows in {time.time()-t0:.1f}s", flush=True)
calendar = trading_calendar(universe)

base_params = dict(sig_cfg["rsi_reversal"])
oversold_values = [20, 25, 30]
period_values = [14, 18, 21, 24, 28]

# rerun everything fresh (engine is fast enough now, ~4x speedup) so
# all/ex2020 metrics are consistently available for every cell
rows = []
for ov in oversold_values:
    for per in period_values:
        params = dict(base_params)
        params["oversold_threshold"] = ov
        params["rsi_period"] = per
        t0 = time.time()
        trades = run_backtest("rsi_reversal", universe, calendar, START, END, params, bt_cfg["holding_period_days"], bt_cfg["costs"])
        metrics_all = summarize_fast(trades)
        ex2020 = summarize_fast(trades[trades["signal_date"].dt.year != 2020])
        log_attempt("rsi_reversal", params, {"start": START, "end": END}, metrics_all)
        print(f"oversold={ov}, period={per} took {time.time()-t0:.1f}s -> all={metrics_all} ex2020={ex2020}", flush=True)
        rows.append({
            "oversold_threshold": ov, "rsi_period": per,
            "n_trades": metrics_all["n_trades"], "mean_return_all": metrics_all["mean_return"],
            "win_rate_all": metrics_all["win_rate"],
            "mean_return_ex2020": ex2020["mean_return"], "win_rate_ex2020": ex2020["win_rate"],
        })

result = pd.DataFrame(rows)
print("\n=== 2D grid result ===", flush=True)
print(result.to_string(), flush=True)

pivot_all = result.pivot(index="rsi_period", columns="oversold_threshold", values="mean_return_all")
print("\n=== mean_return_all pivot (rows=rsi_period, cols=oversold_threshold) ===", flush=True)
print(pivot_all.to_string(), flush=True)

pivot_ex = result.pivot(index="rsi_period", columns="oversold_threshold", values="mean_return_ex2020")
print("\n=== mean_return_ex2020 pivot (rows=rsi_period, cols=oversold_threshold) ===", flush=True)
print(pivot_ex.to_string(), flush=True)

pivot_win_ex = result.pivot(index="rsi_period", columns="oversold_threshold", values="win_rate_ex2020")
print("\n=== win_rate_ex2020 pivot ===", flush=True)
print(pivot_win_ex.to_string(), flush=True)
