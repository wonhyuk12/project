import io
import logging
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from stock_backtest.attempt_log import log_attempt
from stock_backtest.backtest import run_backtest_trailing, trading_calendar
from stock_backtest.config import load_backtest_config, load_signal_config
from stock_backtest.data_loader import load_universe
from stock_backtest import report
from stock_backtest.sweep import summarize_fast

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

sig_cfg = load_signal_config()
bt_cfg = load_backtest_config()
params = sig_cfg["momentum_breakout"]

START, END = "2018-01-01", "2023-12-31"

t0 = time.time()
universe = load_universe(end=END)
print(f"universe loaded: {len(universe)} rows in {time.time()-t0:.1f}s", flush=True)
calendar = trading_calendar(universe)

t0 = time.time()
trades = run_backtest_trailing(
    strategy_name="momentum_breakout",
    universe=universe,
    calendar=calendar,
    start=START,
    end=END,
    signal_params=params,
    trailing_stop_pct=params["trailing_stop_pct"],
    max_holding_days=params["max_holding_days"],
    exempt_top_n_mktcap=params["exempt_top_n_mktcap"],
    cost_params=bt_cfg["costs"],
)
print(f"backtest took {time.time()-t0:.1f}s -> {len(trades)} trades", flush=True)

trades.to_parquet(f"data/results/trades_momentum_breakout_{START}_{END}.parquet", index=False)
log_attempt("momentum_breakout", params, {"start": START, "end": END}, summarize_fast(trades))

print("\n=== summary ===", flush=True)
print(report.summarize(trades, universe, calendar), flush=True)
print("distribution:\n", report.return_distribution(trades), flush=True)
print("yearly:\n", report.yearly_breakdown(trades).to_string(), flush=True)
print("exit_reason:\n", trades["exit_reason"].value_counts(), flush=True)
print("exempt counts:\n", trades["exempt"].value_counts(), flush=True)
print("exempt-only mean_return:", trades.loc[trades["exempt"], "net_return"].mean(), flush=True)
print("non-exempt mean_return:", trades.loc[~trades["exempt"], "net_return"].mean(), flush=True)
