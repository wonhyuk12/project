"""RSI(14) oversold-reversal signal: RSI crosses back above 30 after having
been below it (classic oversold bounce), on liquid names only.

Uses Wilder's smoothing (EWM with alpha=1/period), the standard RSI
definition. Exit is the engine's normal fixed holding-period sell, same as
mean_reversion/trend_following -- this module only defines entries.

Split into compute_features/select -- see mean_reversion.py for why.
"""

from __future__ import annotations

import pandas as pd


def required_lookback(params: dict) -> int:
    # EWM's dependence on data older than ~5x the period is negligible
    return max(params["liquidity_lookback"], params["rsi_period"] * 5)


def _rsi(df: pd.DataFrame, period: int) -> pd.Series:
    delta = df.groupby("ticker")["close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.groupby(df["ticker"]).ewm(alpha=1 / period, adjust=False).mean().reset_index(level=0, drop=True)
    avg_loss = loss.groupby(df["ticker"]).ewm(alpha=1 / period, adjust=False).mean().reset_index(level=0, drop=True)
    rs = avg_gain / avg_loss
    return 100 - 100 / (1 + rs)


def compute_features(past_df: pd.DataFrame, params: dict) -> pd.DataFrame:
    df = past_df.sort_values(["ticker", "date"]).copy()

    liq_win = params["liquidity_lookback"]
    period = params["rsi_period"]

    by_ticker = df.groupby("ticker")
    df["avg_trade_value"] = by_ticker["trade_value"].rolling(liq_win).mean().reset_index(level=0, drop=True)
    df["rsi"] = _rsi(df, period)
    df["rsi_prev"] = df.groupby("ticker")["rsi"].shift(1)
    return df


def select(features_df: pd.DataFrame, date: str | pd.Timestamp, params: dict) -> list[str]:
    date = pd.Timestamp(date)
    today = features_df.loc[features_df["date"] == date]
    if today.empty:
        return []

    oversold = params["oversold_threshold"]
    mask = (
        (today["avg_trade_value"] >= params["liquidity_min_avg_trade_value"])
        & (today["rsi_prev"] < oversold)
        & (today["rsi"] >= oversold)
    )
    return today.loc[mask, "ticker"].tolist()


def generate(past_df: pd.DataFrame, date: str | pd.Timestamp, params: dict) -> list[str]:
    date = pd.Timestamp(date)
    df = past_df.loc[past_df["date"] <= date]
    return select(compute_features(df, params), date, params)
