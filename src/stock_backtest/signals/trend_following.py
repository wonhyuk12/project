"""Trend-following signal: liquid stocks trading above their long-term
moving average that just broke out to an N-day high.

Split into compute_features/select -- see mean_reversion.py for why.
"""

from __future__ import annotations

import pandas as pd


def required_lookback(params: dict) -> int:
    return max(
        params["liquidity_lookback"],
        params["ma_period"],
        params["breakout_lookback"] + 1,
    )


def compute_features(past_df: pd.DataFrame, params: dict) -> pd.DataFrame:
    df = past_df.sort_values(["ticker", "date"]).copy()

    liq_win = params["liquidity_lookback"]
    ma_period = params["ma_period"]
    bo_win = params["breakout_lookback"]

    by_ticker = df.groupby("ticker")
    df["avg_trade_value"] = by_ticker["trade_value"].rolling(liq_win).mean().reset_index(level=0, drop=True)
    df["ma"] = by_ticker["close"].rolling(ma_period).mean().reset_index(level=0, drop=True)
    # prior_high excludes today, so today's own close can't count as its own breakout level
    shifted_close = by_ticker["close"].shift(1)
    df["prior_high"] = shifted_close.groupby(df["ticker"]).rolling(bo_win).max().reset_index(level=0, drop=True)
    return df


def select(features_df: pd.DataFrame, date: str | pd.Timestamp, params: dict) -> list[str]:
    date = pd.Timestamp(date)
    today = features_df.loc[features_df["date"] == date]
    if today.empty:
        return []

    mask = (
        (today["avg_trade_value"] >= params["liquidity_min_avg_trade_value"])
        & (today["close"] > today["ma"])
        & (today["close"] > today["prior_high"])
    )
    return today.loc[mask, "ticker"].tolist()


def generate(past_df: pd.DataFrame, date: str | pd.Timestamp, params: dict) -> list[str]:
    date = pd.Timestamp(date)
    df = past_df.loc[past_df["date"] <= date]
    return select(compute_features(df, params), date, params)
