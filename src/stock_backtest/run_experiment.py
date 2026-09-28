"""Run both strategies over a date range and dump trades + summary reports.

Usage:
    uv run python -m stock_backtest.run_experiment --start 2018-01-01 --end 2023-12-31
"""

from __future__ import annotations

import argparse
import logging
import time
from pathlib import Path

from stock_backtest.backtest import run_backtest, trading_calendar
from stock_backtest.config import load_backtest_config, load_signal_config
from stock_backtest.data_loader import load_universe
from stock_backtest import report

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--out-dir", default="data/results")
    args = parser.parse_args()

    sig_cfg = load_signal_config()
    bt_cfg = load_backtest_config()

    t0 = time.time()
    universe = load_universe(end=args.end)
    logger.info("universe loaded: %d rows in %.1fs", len(universe), time.time() - t0)
    calendar = trading_calendar(universe)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    results = {}
    for name in ["mean_reversion", "trend_following"]:
        t0 = time.time()
        trades = run_backtest(
            strategy_name=name,
            universe=universe,
            calendar=calendar,
            start=args.start,
            end=args.end,
            signal_params=sig_cfg[name],
            holding_period_days=bt_cfg["holding_period_days"],
            cost_params=bt_cfg["costs"],
        )
        logger.info("%s: %.1fs -> %d trades", name, time.time() - t0, len(trades))
        trades.to_parquet(out_dir / f"trades_{name}_{args.start}_{args.end}.parquet", index=False)
        results[name] = trades

    for name, trades in results.items():
        print(f"\n=== {name} ===")
        print("summary:", report.summarize(trades, universe, calendar))
        print("distribution:\n", report.return_distribution(trades))
        print("yearly:\n", report.yearly_breakdown(trades).to_string())
        print("exit_reason:\n", trades["exit_reason"].value_counts())

    print("\n=== comparison ===")
    print(report.compare_strategies(results, universe, calendar).to_string())


if __name__ == "__main__":
    main()
