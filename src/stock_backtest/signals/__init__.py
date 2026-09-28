from stock_backtest.signals import macd_crossover, mean_reversion, momentum_breakout, rsi_reversal, trend_following

STRATEGIES = {
    "mean_reversion": mean_reversion,
    "trend_following": trend_following,
    "momentum_breakout": momentum_breakout,
    "rsi_reversal": rsi_reversal,
    "macd_crossover": macd_crossover,
}
