from __future__ import annotations

from pathlib import Path

import yaml

DEFAULT_CONFIG_PATH = Path("config/signals.yaml")
DEFAULT_BACKTEST_CONFIG_PATH = Path("config/backtest.yaml")


def load_signal_config(path: Path = DEFAULT_CONFIG_PATH) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_backtest_config(path: Path = DEFAULT_BACKTEST_CONFIG_PATH) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)
