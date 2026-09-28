"""Day-by-day backtest engine.

Loop mechanics: walk the real KRX trading calendar one day at a time. Each
strategy's rolling features are computed once up front via
module.compute_features() (backward-only rolling/shift, so precomputing
over the whole range is equivalent to recomputing per-day, just far
cheaper), then module.select(features, date, params) reads only the
date == T row -- so day T's decision structurally can't see date > T even
though the precomputed table extends past it. For every signaled ticker:
buy at T+1's open, sell at (T+1 + holding_period_days)'s open.

Delisting-during-hold handling (explicit product decision, not something I
picked on my own): if a ticker has no price on the intended exit day because
it delisted first, exit at its last available close instead of dropping the
trade. Dropping it would silently re-introduce the survivorship bias this
whole project exists to avoid.
"""

from __future__ import annotations

import logging

import pandas as pd

from stock_backtest.signals import STRATEGIES

logger = logging.getLogger(__name__)

MAX_FORWARD_SEARCH_DAYS = 5  # trading-halt tolerance when looking up entry/exit prices


def trading_calendar(universe: pd.DataFrame) -> pd.DatetimeIndex:
    return pd.DatetimeIndex(sorted(universe["date"].unique()))


def _lookup_price(
    ticker_df: pd.DataFrame, target_date: pd.Timestamp, price_col: str, max_forward: int
) -> tuple[pd.Timestamp, float] | None:
    """First available (date, price) at or after target_date, within max_forward
    trading days of the ticker's own history (tolerates short halts)."""
    candidates = ticker_df.loc[ticker_df["date"] >= target_date]
    if candidates.empty:
        return None
    row = candidates.iloc[0]
    # bail out if the nearest available day is implausibly far (halt too long
    # / no more data at all past a point well beyond target_date)
    if (row["date"] - target_date).days > max_forward * 3:  # calendar-day slack for weekends
        return None
    return row["date"], row[price_col]


def run_backtest(
    strategy_name: str,
    universe: pd.DataFrame,
    calendar: pd.DatetimeIndex,
    start: str,
    end: str,
    signal_params: dict,
    holding_period_days: int,
    cost_params: dict,
) -> pd.DataFrame:
    """Returns one row per executed trade."""
    module = STRATEGIES[strategy_name]

    by_ticker = {t: g for t, g in universe.groupby("ticker")}
    # features computed once over the whole range instead of once per loop
    # iteration -- rolling/shift are backward-only, so this changes nothing
    # about what any given day's signal sees, just how often we do the math
    features = module.compute_features(universe, signal_params)

    start_ts, end_ts = pd.Timestamp(start), pd.Timestamp(end)
    signal_dates = calendar[(calendar >= start_ts) & (calendar <= end_ts)]

    trades = []
    n_signals = 0

    for pos in range(len(calendar)):
        date = calendar[pos]
        if date not in signal_dates:
            continue
        if pos + 1 >= len(calendar):
            break  # no next day to enter on

        tickers = module.select(features, date, signal_params)
        n_signals += len(tickers)

        entry_date = calendar[pos + 1]
        exit_idx = pos + 1 + holding_period_days
        target_exit_date = calendar[exit_idx] if exit_idx < len(calendar) else calendar[-1]

        for ticker in tickers:
            tdf = by_ticker.get(ticker)
            if tdf is None:
                continue

            entry = _lookup_price(tdf, entry_date, "open", MAX_FORWARD_SEARCH_DAYS)
            if entry is None:
                logger.info("skip %s signal=%s: no entry price available", ticker, date.date())
                continue
            actual_entry_date, entry_price = entry
            if entry_price <= 0:
                continue

            exit_ = _lookup_price(tdf, target_exit_date, "open", MAX_FORWARD_SEARCH_DAYS)
            if exit_ is not None:
                actual_exit_date, exit_price, exit_reason = *exit_, "normal"
            else:
                # no trading day at/after target_exit_date -> delisted (or data
                # ends) before the holding period completed. Exit at the last
                # close we do have, instead of dropping the trade.
                last_row = tdf.loc[tdf["date"] >= actual_entry_date].iloc[-1]
                actual_exit_date, exit_price, exit_reason = (
                    last_row["date"], last_row["close"], "delisted_early",
                )
                if actual_exit_date <= actual_entry_date:
                    continue  # nothing tradeable after entry at all

            buy_fill = entry_price * (1 + cost_params["slippage_rate"])
            buy_cost = buy_fill * cost_params["commission_rate"]
            sell_fill = exit_price * (1 - cost_params["slippage_rate"])
            sell_cost = sell_fill * (cost_params["commission_rate"] + cost_params["tax_rate"])

            gross_return = exit_price / entry_price - 1
            net_return = (sell_fill - sell_cost - (buy_fill + buy_cost)) / (buy_fill + buy_cost)

            trades.append({
                "strategy": strategy_name,
                "ticker": ticker,
                "signal_date": date,
                "entry_date": actual_entry_date,
                "entry_price": entry_price,
                "buy_fill": buy_fill,
                "exit_date": actual_exit_date,
                "exit_price": exit_price,
                "sell_fill": sell_fill,
                "exit_reason": exit_reason,
                "gross_return": gross_return,
                "net_return": net_return,
            })

    logger.info(
        "%s: %d signals -> %d trades executed (%s ~ %s)",
        strategy_name, n_signals, len(trades), start, end,
    )
    return pd.DataFrame(trades)


def _cost_adjusted_return(entry_price: float, exit_price: float, cost_params: dict) -> dict:
    buy_fill = entry_price * (1 + cost_params["slippage_rate"])
    buy_cost = buy_fill * cost_params["commission_rate"]
    sell_fill = exit_price * (1 - cost_params["slippage_rate"])
    sell_cost = sell_fill * (cost_params["commission_rate"] + cost_params["tax_rate"])
    return {
        "buy_fill": buy_fill,
        "sell_fill": sell_fill,
        "gross_return": exit_price / entry_price - 1,
        "net_return": (sell_fill - sell_cost - (buy_fill + buy_cost)) / (buy_fill + buy_cost),
    }


def _lookup_price_indexed(
    tdf: pd.DataFrame, target_date: pd.Timestamp, price_col: str, max_forward: int
) -> tuple[pd.Timestamp, float] | None:
    candidates = tdf.loc[tdf.index >= target_date]
    if candidates.empty:
        return None
    idx = candidates.index[0]
    if (idx - target_date).days > max_forward * 3:
        return None
    return idx, candidates[price_col].iloc[0]


def run_backtest_trailing(
    strategy_name: str,
    universe: pd.DataFrame,
    calendar: pd.DatetimeIndex,
    start: str,
    end: str,
    signal_params: dict,
    trailing_stop_pct: float,
    max_holding_days: int,
    exempt_top_n_mktcap: int,
    cost_params: dict,
) -> pd.DataFrame:
    """Same day-by-day, no-look-ahead loop as run_backtest, but exit is a
    trailing stop (sell when close falls trailing_stop_pct below the highest
    close since entry) instead of a fixed holding period, with a
    max_holding_days safety cap. The exempt_top_n_mktcap largest-cap tickers
    *as of the signal date* (never a fixed list -- that would be look-ahead,
    since who's in the top N changes over the years) skip the trailing stop
    and ride to the max-holding cap instead.
    """
    module = STRATEGIES[strategy_name]

    by_ticker = {t: g.set_index("date").sort_index() for t, g in universe.groupby("ticker")}
    features = module.compute_features(universe, signal_params)

    start_ts, end_ts = pd.Timestamp(start), pd.Timestamp(end)
    signal_dates = calendar[(calendar >= start_ts) & (calendar <= end_ts)]

    trades = []
    n_signals = 0

    for pos in range(len(calendar)):
        date = calendar[pos]
        if date not in signal_dates:
            continue
        if pos + 1 >= len(calendar):
            break

        tickers = module.select(features, date, signal_params)
        n_signals += len(tickers)

        today_snapshot = universe.loc[universe["date"] == date]
        exempt_today = (
            set(today_snapshot.nlargest(exempt_top_n_mktcap, "mktcap")["ticker"])
            if exempt_top_n_mktcap else set()
        )

        entry_date = calendar[pos + 1]
        max_exit_pos = min(pos + 1 + max_holding_days, len(calendar) - 1)
        max_exit_date = calendar[max_exit_pos]

        for ticker in tickers:
            tdf = by_ticker.get(ticker)
            if tdf is None:
                continue

            entry = _lookup_price_indexed(tdf, entry_date, "open", MAX_FORWARD_SEARCH_DAYS)
            if entry is None:
                continue
            actual_entry_date, entry_price = entry
            if entry_price <= 0 or actual_entry_date > max_exit_date:
                continue

            path = tdf.loc[actual_entry_date:max_exit_date]
            if path.empty:
                continue

            actual_exit_date = None
            exit_price = None
            exit_reason = None

            if ticker not in exempt_today:
                running_peak = path["close"].cummax()
                drawdown_from_peak = path["close"] / running_peak - 1
                triggered = drawdown_from_peak[drawdown_from_peak <= trailing_stop_pct]
                if not triggered.empty:
                    trigger_date = triggered.index[0]
                    after = path.loc[path.index > trigger_date]
                    if not after.empty:
                        actual_exit_date = after.index[0]
                        exit_price = after["open"].iloc[0]
                        exit_reason = "trailing_stop"

            if actual_exit_date is None:
                last_date = path.index[-1]
                if last_date < max_exit_date:
                    # ticker's data ends before the max-holding horizon -> delisted
                    actual_exit_date, exit_price, exit_reason = (
                        last_date, path["close"].iloc[-1], "delisted_early",
                    )
                else:
                    actual_exit_date, exit_price, exit_reason = (
                        max_exit_date, path.loc[max_exit_date, "open"], "max_holding",
                    )

            if actual_exit_date <= actual_entry_date:
                continue

            costs = _cost_adjusted_return(entry_price, exit_price, cost_params)
            trades.append({
                "strategy": strategy_name,
                "ticker": ticker,
                "signal_date": date,
                "entry_date": actual_entry_date,
                "entry_price": entry_price,
                "exit_date": actual_exit_date,
                "exit_price": exit_price,
                "exit_reason": exit_reason,
                "exempt": ticker in exempt_today,
                **costs,
            })

    logger.info(
        "%s (trailing): %d signals -> %d trades executed (%s ~ %s)",
        strategy_name, n_signals, len(trades), start, end,
    )
    return pd.DataFrame(trades)
