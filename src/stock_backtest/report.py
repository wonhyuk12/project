"""Summary statistics for a trades DataFrame produced by backtest.run_backtest.

MDD is computed from a reporting-only equity curve: every day, capital is
split equally across whatever positions are open that day and marked to
market at close (buy/sell-day edges use the actual cost-adjusted fill
price, not raw close, so commissions/tax/slippage still show up in the
curve). This is NOT the strategy's real position-sizing rule -- there isn't
one yet (position sizing is an explicit unimplemented extension slot) -- it
is a standard "how rough would this have felt" reporting assumption, kept
separate from the strategy logic itself.
"""

from __future__ import annotations

import pandas as pd


def _trade_daily_returns(trades: pd.DataFrame, universe: pd.DataFrame) -> pd.DataFrame:
    """One row per (trade, date) the trade was held, with that day's markout return."""
    close_by_ticker = {t: g.set_index("date")["close"].sort_index() for t, g in universe.groupby("ticker")}

    rows = []
    for trade_id, trade in trades.reset_index(drop=True).iterrows():
        s = close_by_ticker.get(trade["ticker"])
        if s is None:
            continue
        dates = s.loc[trade["entry_date"]:trade["exit_date"]].index
        if len(dates) == 0:
            continue
        if len(dates) == 1:
            rows.append((dates[0], trade_id, trade["sell_fill"] / trade["buy_fill"] - 1))
            continue

        rows.append((dates[0], trade_id, s.loc[dates[0]] / trade["buy_fill"] - 1))
        for i in range(1, len(dates) - 1):
            rows.append((dates[i], trade_id, s.loc[dates[i]] / s.loc[dates[i - 1]] - 1))
        rows.append((dates[-1], trade_id, trade["sell_fill"] / s.loc[dates[-2]] - 1))

    return pd.DataFrame(rows, columns=["date", "trade_id", "daily_return"])


def daily_portfolio_returns(trades: pd.DataFrame, universe: pd.DataFrame, calendar: pd.DatetimeIndex) -> pd.Series:
    """Equal-weight-across-open-positions daily return, reindexed to the full
    calendar (days with no open position return 0 -- idle capital)."""
    if trades.empty:
        return pd.Series(0.0, index=calendar)
    per_trade_day = _trade_daily_returns(trades, universe)
    daily = per_trade_day.groupby("date")["daily_return"].mean()
    return daily.reindex(calendar, fill_value=0.0)


def _max_drawdown(daily_returns: pd.Series) -> float:
    if daily_returns.empty:
        return 0.0
    equity = (1 + daily_returns).cumprod()
    running_max = equity.cummax()
    drawdown = equity / running_max - 1
    return drawdown.min()


def summarize(trades: pd.DataFrame, universe: pd.DataFrame, calendar: pd.DatetimeIndex) -> dict:
    if trades.empty:
        return {
            "n_signals_executed": 0, "n_delisted_early": 0,
            "mean_return": None, "median_return": None, "win_rate": None, "mdd": None,
        }
    daily_returns = daily_portfolio_returns(trades, universe, calendar)
    return {
        "n_signals_executed": len(trades),
        "n_delisted_early": int((trades["exit_reason"] == "delisted_early").sum()),
        "mean_return": trades["net_return"].mean(),
        "median_return": trades["net_return"].median(),
        "win_rate": (trades["net_return"] > 0).mean(),
        "mdd": _max_drawdown(daily_returns),
    }


def return_distribution(trades: pd.DataFrame, quantiles=(0.05, 0.25, 0.5, 0.75, 0.95)) -> pd.Series:
    return trades["net_return"].quantile(quantiles)


def yearly_breakdown(trades: pd.DataFrame) -> pd.DataFrame:
    if trades.empty:
        return pd.DataFrame(columns=["year", "n_trades", "mean_return", "median_return", "win_rate"])
    df = trades.assign(year=trades["signal_date"].dt.year)
    g = df.groupby("year")["net_return"]
    out = g.agg(n_trades="count", mean_return="mean", median_return="median")
    out["win_rate"] = g.apply(lambda s: (s > 0).mean())
    return out.reset_index()


def compare_strategies(trades_by_strategy: dict[str, pd.DataFrame], universe: pd.DataFrame, calendar: pd.DatetimeIndex) -> pd.DataFrame:
    rows = []
    for name, trades in trades_by_strategy.items():
        row = {"strategy": name, **summarize(trades, universe, calendar)}
        rows.append(row)
    return pd.DataFrame(rows)
