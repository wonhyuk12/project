"""MACD crossover signal: MACD line crosses above its signal line (classic
"crossup"), on liquid names only.

Standard Gerald Appel parameters: fast EMA 12, slow EMA 26, signal EMA 9.
Exit is the engine's normal fixed holding-period sell, same as
mean_reversion/trend_following/rsi_reversal -- this module only defines
entries.

Split into compute_features/select -- see mean_reversion.py for why.
"""

from __future__ import annotations

import pandas as pd


def required_lookback(params: dict) -> int:
    # EWM's dependence on data older than ~5x the period is negligible
    return max(params["liquidity_lookback"], params["slow_period"] * 5)


def _macd(df: pd.DataFrame, fast: int, slow: int, signal: int) -> tuple[pd.Series, pd.Series]:
    by_ticker = df.groupby("ticker")["close"]
    ema_fast = by_ticker.ewm(span=fast, adjust=False).mean().reset_index(level=0, drop=True)
    ema_slow = by_ticker.ewm(span=slow, adjust=False).mean().reset_index(level=0, drop=True)
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.groupby(df["ticker"]).ewm(span=signal, adjust=False).mean().reset_index(level=0, drop=True)
    return macd_line, signal_line


def compute_features(past_df: pd.DataFrame, params: dict) -> pd.DataFrame:
    df = past_df.sort_values(["ticker", "date"]).copy()

    liq_win = params["liquidity_lookback"]
    fast, slow, signal = params["fast_period"], params["slow_period"], params["signal_period"]

    by_ticker = df.groupby("ticker")
    df["avg_trade_value"] = by_ticker["trade_value"].rolling(liq_win).mean().reset_index(level=0, drop=True)
    df["macd"], df["macd_signal"] = _macd(df, fast, slow, signal)
    df["macd_diff"] = df["macd"] - df["macd_signal"]
    df["macd_diff_prev"] = df.groupby("ticker")["macd_diff"].shift(1)
    return df


def select(features_df: pd.DataFrame, date: str | pd.Timestamp, params: dict) -> list[str]:
    date = pd.Timestamp(date)
    today = features_df.loc[features_df["date"] == date]
    if today.empty:
        return []

    # crossup: diff was <= 0 yesterday, > 0 today
    mask = (
        (today["avg_trade_value"] >= params["liquidity_min_avg_trade_value"])
        & (today["macd_diff_prev"] <= 0)
        & (today["macd_diff"] > 0)
    )
    return today.loc[mask, "ticker"].tolist()


def generate(past_df: pd.DataFrame, date: str | pd.Timestamp, params: dict) -> list[str]:
    date = pd.Timestamp(date)
    df = past_df.loc[past_df["date"] <= date]
    return select(compute_features(df, params), date, params)
