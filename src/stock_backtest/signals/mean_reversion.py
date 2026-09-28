"""Mean-reversion signal: liquid stocks that sold off harder than the market,
without a volume spike suggesting the drop is news-driven.

Split into compute_features (vectorized once over the whole date range) and
select (a cheap per-day filter), so the backtest engine can precompute
features a single time instead of recomputing rolling windows on every one
of ~1500 loop iterations -- rolling/shift only ever look backward from each
row, so precomputing over a wider date range changes nothing about what a
given day's signal sees, just how many times we do the arithmetic.
generate() is kept as a thin wrapper (compute_features + select) for
standalone use/testing where that's not a concern.

Look-ahead safety: select() only ever reads the row(s) with date == `date`,
so it structurally can't see anything from later dates even if features_df
extends past it.
"""

from __future__ import annotations

import pandas as pd


def required_lookback(params: dict) -> int:
    return max(
        params["liquidity_lookback"],
        params["drawdown_lookback"],
        params["volume_spike_lookback"] + 1,
    )


def compute_features(past_df: pd.DataFrame, params: dict) -> pd.DataFrame:
    df = past_df.sort_values(["ticker", "date"]).copy()

    liq_win = params["liquidity_lookback"]
    dd_win = params["drawdown_lookback"]
    vol_win = params["volume_spike_lookback"]

    by_ticker = df.groupby("ticker")
    df["avg_trade_value"] = by_ticker["trade_value"].rolling(liq_win).mean().reset_index(level=0, drop=True)
    df["rolling_high"] = by_ticker["close"].rolling(dd_win).max().reset_index(level=0, drop=True)
    df["window_start_close"] = by_ticker["close"].shift(dd_win - 1)
    df["window_start_idx"] = by_ticker["idx_close"].shift(dd_win - 1)
    # avg_volume excludes today so a spike today can't inflate its own baseline
    shifted_volume = by_ticker["volume"].shift(1)
    df["avg_volume"] = shifted_volume.groupby(df["ticker"]).rolling(vol_win).mean().reset_index(level=0, drop=True)

    df["drawdown"] = df["close"] / df["rolling_high"] - 1
    stock_window_return = df["close"] / df["window_start_close"] - 1
    idx_window_return = df["idx_close"] / df["window_start_idx"] - 1
    df["excess_decline"] = stock_window_return - idx_window_return
    df["volume_ratio"] = df["volume"] / df["avg_volume"]
    return df


def select(features_df: pd.DataFrame, date: str | pd.Timestamp, params: dict) -> list[str]:
    date = pd.Timestamp(date)
    today = features_df.loc[features_df["date"] == date]
    if today.empty:
        return []

    mask = (
        (today["avg_trade_value"] >= params["liquidity_min_avg_trade_value"])
        & (today["drawdown"] <= params["drawdown_min_pct"])
        & (today["excess_decline"] <= params["excess_decline_min_pct"])
        & (today["volume_ratio"] < params["volume_spike_multiplier"])
    )
    return today.loc[mask, "ticker"].tolist()


def generate(past_df: pd.DataFrame, date: str | pd.Timestamp, params: dict) -> list[str]:
    date = pd.Timestamp(date)
    df = past_df.loc[past_df["date"] <= date]
    return select(compute_features(df, params), date, params)
