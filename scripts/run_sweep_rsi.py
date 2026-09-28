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

base_params = dict(sig_cfg["rsi_reversal"])


def run_one(params, label):
    t0 = time.time()
    trades = run_backtest("rsi_reversal", universe, calendar, START, END, params, bt_cfg["holding_period_days"], bt_cfg["costs"])
    metrics_all = summarize_fast(trades)
    ex2020 = summarize_fast(trades[trades["signal_date"].dt.year != 2020])
    log_attempt("rsi_reversal", params, {"start": START, "end": END}, metrics_all)
    print(f"{label} took {time.time()-t0:.1f}s -> all={metrics_all} ex2020={ex2020}", flush=True)
    return metrics_all, ex2020


print("\n### SWEEP 1: oversold_threshold (rsi_period=14 fixed) ###", flush=True)
rows1 = []
for v in [20, 25, 30, 35, 40]:
    params = dict(base_params)
    params["oversold_threshold"] = v
    m_all, m_ex = run_one(params, f"oversold_threshold={v}")
    rows1.append({"oversold_threshold": v, "mean_return_all": m_all["mean_return"], "win_rate_all": m_all["win_rate"],
                   "mean_return_ex2020": m_ex["mean_return"], "win_rate_ex2020": m_ex["win_rate"], "n_trades": m_all["n_trades"]})
result1 = pd.DataFrame(rows1)
print(result1.to_string(), flush=True)
print("stability(all):", check_stability(result1.rename(columns={"mean_return_all": "mean_return"}), "oversold_threshold", "mean_return"), flush=True)
print("stability(ex2020):", check_stability(result1.rename(columns={"mean_return_ex2020": "mean_return"}), "oversold_threshold", "mean_return"), flush=True)

print("\n### SWEEP 2: rsi_period (oversold_threshold=30 fixed) ###", flush=True)
rows2 = []
for v in [7, 10, 14, 21, 28]:
    params = dict(base_params)
    params["rsi_period"] = v
    m_all, m_ex = run_one(params, f"rsi_period={v}")
    rows2.append({"rsi_period": v, "mean_return_all": m_all["mean_return"], "win_rate_all": m_all["win_rate"],
                   "mean_return_ex2020": m_ex["mean_return"], "win_rate_ex2020": m_ex["win_rate"], "n_trades": m_all["n_trades"]})
result2 = pd.DataFrame(rows2)
print(result2.to_string(), flush=True)
print("stability(all):", check_stability(result2.rename(columns={"mean_return_all": "mean_return"}), "rsi_period", "mean_return"), flush=True)
print("stability(ex2020):", check_stability(result2.rename(columns={"mean_return_ex2020": "mean_return"}), "rsi_period", "mean_return"), flush=True)
