import io
import logging
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from stock_backtest.attempt_log import log_attempt
from stock_backtest.backtest import run_backtest, trading_calendar
from stock_backtest.config import load_backtest_config, load_signal_config
from stock_backtest.data_loader import load_universe
from stock_backtest import report
from stock_backtest.sweep import summarize_fast

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

sig_cfg = load_signal_config()
bt_cfg = load_backtest_config()
params = sig_cfg["rsi_reversal"]

START, END = "2018-01-01", "2023-12-31"

t0 = time.time()
universe = load_universe(end=END)
print(f"universe loaded: {len(universe)} rows in {time.time()-t0:.1f}s", flush=True)
calendar = trading_calendar(universe)

t0 = time.time()
trades = run_backtest(
    "rsi_reversal", universe, calendar, START, END, params,
    bt_cfg["holding_period_days"], bt_cfg["costs"],
)
print(f"backtest took {time.time()-t0:.1f}s -> {len(trades)} trades", flush=True)

trades.to_parquet(f"data/results/trades_rsi_reversal_{START}_{END}.parquet", index=False)
log_attempt("rsi_reversal", params, {"start": START, "end": END}, summarize_fast(trades))

trades_ex2020 = trades[trades["signal_date"].dt.year != 2020]

print("\n=== summary (all years) ===", flush=True)
print(report.summarize(trades, universe, calendar), flush=True)
print("\n=== summary (ex-2020) ===", flush=True)
print(summarize_fast(trades_ex2020), flush=True)
print("\ndistribution:\n", report.return_distribution(trades), flush=True)
print("\nyearly:\n", report.yearly_breakdown(trades).to_string(), flush=True)
print("\nexit_reason:\n", trades["exit_reason"].value_counts(), flush=True)
