"""2024-현재 최종 판정 전용 모듈. 딱 한 번, 모든 파라미터 결정이 끝난 뒤에만 써라.

Nothing in signals/, backtest.py, report.py, sweep.py, or run_experiment.py
imports this module, and it must stay that way -- that separation is the
whole point of 기간 분리. data_loader.load_universe() hard-caps at
EXPERIMENT_END_DATE (2023-12-31) and raises PermissionError past it; this
module is the one deliberate bypass, used exactly once per project.

If you're importing this from anywhere other than a final one-shot judgment
script you run by hand, stop -- that's the exact mistake 기간 분리 exists to
catch.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from stock_backtest.data_loader import DATA_DIR


def load_universe_unrestricted(
    start: str | None = None,
    end: str | None = None,
    instrument_types: tuple[str, ...] = ("common",),
    data_dir: Path = DATA_DIR,
) -> pd.DataFrame:
    """Same shape as data_loader.load_universe, no end-date cap."""
    price = pd.read_parquet(data_dir / "daily_price")
    meta = pd.read_parquet(data_dir / "ticker_meta" / "ticker_meta.parquet")
    index = pd.read_parquet(data_dir / "index_price" / "index_price.parquet")

    keep_tickers = meta.loc[meta["instrument_type"].isin(instrument_types), "ticker"]
    price = price[price["ticker"].isin(keep_tickers)]

    if start is not None:
        price = price[price["date"] >= pd.Timestamp(start)]
    if end is not None:
        price = price[price["date"] <= pd.Timestamp(end)]

    index = index.sort_values(["market", "date"]).copy()
    index["idx_return"] = index.groupby("market")["close"].pct_change()
    index = index.rename(columns={"close": "idx_close"})[
        ["date", "market", "idx_close", "idx_return"]
    ]

    df = price.merge(index, on=["date", "market"], how="left")
    return df.sort_values(["ticker", "date"]).reset_index(drop=True)
