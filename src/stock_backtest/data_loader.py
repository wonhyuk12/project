"""Load raw parquet data into the long-format universe DataFrame signals consume.

Excess-return signals need each stock's return compared against its own
market's index on the same day, so index_price is joined in here rather
than left for every signal module to re-join.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

DATA_DIR = Path("data/raw")

# 2018~2023 = 실험용, 2024~현재 = 최종 판정용. This module is the one every
# experimental script (signals, backtest, sweep) imports, so capping it here
# is what "실험 단계 코드에서는 아예 못 읽게 막을 것" actually means in code.
# The only way to see 2024+ is stock_backtest.final_judgment, a separate
# module nothing experimental imports.
EXPERIMENT_END_DATE = pd.Timestamp("2023-12-31")


def load_universe(
    start: str | None = None,
    end: str | None = None,
    instrument_types: tuple[str, ...] = ("common",),
    data_dir: Path = DATA_DIR,
) -> pd.DataFrame:
    """Long-format daily_price, filtered to instrument_types and joined with
    the same-market index close (idx_close) and index return (idx_return).

    Columns: ticker, date, open, high, low, close, volume, trade_value,
    market, idx_close, idx_return.
    """
    end_ts = pd.Timestamp(end) if end is not None else EXPERIMENT_END_DATE
    if end_ts > EXPERIMENT_END_DATE:
        raise PermissionError(
            f"load_universe(end={end}) exceeds the experiment cutoff "
            f"{EXPERIMENT_END_DATE.date()}. 2024+ is 최종 판정용 -- experimental "
            "code (signals/backtest/sweep) must not read it. Use "
            "stock_backtest.final_judgment for the one-time final run."
        )

    price = pd.read_parquet(data_dir / "daily_price")
    meta = pd.read_parquet(data_dir / "ticker_meta" / "ticker_meta.parquet")
    index = pd.read_parquet(data_dir / "index_price" / "index_price.parquet")

    keep_tickers = meta.loc[meta["instrument_type"].isin(instrument_types), "ticker"]
    price = price[price["ticker"].isin(keep_tickers)]

    if start is not None:
        price = price[price["date"] >= pd.Timestamp(start)]
    price = price[price["date"] <= end_ts]

    index = index.sort_values(["market", "date"]).copy()
    index["idx_return"] = index.groupby("market")["close"].pct_change()
    index = index.rename(columns={"close": "idx_close"})[
        ["date", "market", "idx_close", "idx_return"]
    ]

    df = price.merge(index, on=["date", "market"], how="left")
    return df.sort_values(["ticker", "date"]).reset_index(drop=True)
