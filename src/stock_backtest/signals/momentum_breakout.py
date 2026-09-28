"""Short-window momentum signal: liquid stocks that have already gained at
least momentum_min_pct within the last momentum_lookback trading days.

Not a prediction -- it reacts to a completed move and bets the move
continues, same family as trend_following just on a much shorter window.

Split into compute_features/select -- see mean_reversion.py for why.
"""

from __future__ import annotations

import pandas as pd


def required_lookback(params: dict) -> int:
    return max(params["liquidity_lookback"], params["momentum_lookback"])


def compute_features(past_df: pd.DataFrame, params: dict) -> pd.DataFrame:
    df = past_df.sort_values(["ticker", "date"]).copy()

    liq_win = params["liquidity_lookback"]
    mom_win = params["momentum_lookback"]

    by_ticker = df.groupby("ticker")
    df["avg_trade_value"] = by_ticker["trade_value"].rolling(liq_win).mean().reset_index(level=0, drop=True)
    df["window_start_close"] = by_ticker["close"].shift(mom_win)
    df["momentum_return"] = df["close"] / df["window_start_close"] - 1
    return df


def select(features_df: pd.DataFrame, date: str | pd.Timestamp, params: dict) -> list[str]:
    date = pd.Timestamp(date)
    today = features_df.loc[features_df["date"] == date]
    if today.empty:
        return []

    mask = (
        (today["avg_trade_value"] >= params["liquidity_min_avg_trade_value"])
        & (today["momentum_return"] >= params["momentum_min_pct"])
    )
    return today.loc[mask, "ticker"].tolist()


def generate(past_df: pd.DataFrame, date: str | pd.Timestamp, params: dict) -> list[str]:
    date = pd.Timestamp(date)
    df = past_df.loc[past_df["date"] <= date]
    return select(compute_features(df, params), date, params)
