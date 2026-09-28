"""Ingest KOSPI/KOSDAQ daily OHLCV from KRX Open API into partitioned parquet.

One API call = one (market, date) snapshot of every listed instrument that
traded that day, delisted-by-now names included (verified 2026-09-01: KOSPI
2018-01-02 snapshot has 66 tickers absent from the 2025-09-02 snapshot, and
their price history is still served). So the "build a ticker universe first"
step used by the old pykrx approach is unnecessary here -- looping every
business day naturally covers every ticker that ever traded in the window.

Usage:
    uv run python -m stock_backtest.ingest_daily
    uv run python -m stock_backtest.ingest_daily --start 2018-01-01 --end 2026-09-01
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from tqdm import tqdm

from stock_backtest.classify import classify_instrument
from stock_backtest.krx_openapi import KRXAuthError, KRXOpenAPIClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("logs/ingest_daily.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

MARKETS = ["KOSPI", "KOSDAQ"]

# response field -> our schema column
FIELD_MAP = {
    "ISU_CD": "ticker",
    "ISU_NM": "name",
    "TDD_OPNPRC": "open",
    "TDD_HGPRC": "high",
    "TDD_LWPRC": "low",
    "TDD_CLSPRC": "close",
    "ACC_TRDVOL": "volume",
    "ACC_TRDVAL": "trade_value",
    "MKTCAP": "mktcap",
}
NUMERIC_COLS = ["open", "high", "low", "close", "volume", "trade_value", "mktcap"]


def business_days(start: str, end: str) -> list[str]:
    idx = pd.bdate_range(start, end)
    return [d.strftime("%Y%m%d") for d in idx]


def fetch_all(client: KRXOpenAPIClient, dates: list[str], log_path: Path) -> pd.DataFrame:
    rows: list[dict] = []
    log_f = log_path.open("a", encoding="utf-8")

    total = len(dates) * len(MARKETS)
    with tqdm(total=total, desc="fetching KRX daily trade") as pbar:
        for date in dates:
            for market in MARKETS:
                try:
                    records = client.get_daily_trade(market, date)
                except KRXAuthError as exc:
                    logger.error("auth error for %s %s: %s -- aborting", market, date, exc)
                    log_f.close()
                    raise
                except Exception as exc:  # noqa: BLE001 -- log and keep going per project rules
                    logger.error("failed %s %s: %s", market, date, exc)
                    log_f.write(json.dumps(
                        {"date": date, "market": market, "status": "error", "error": str(exc)}
                    ) + "\n")
                    pbar.update(1)
                    continue

                status = "ok" if records else "empty"
                log_f.write(json.dumps(
                    {"date": date, "market": market, "status": status, "rows": len(records)}
                ) + "\n")

                for rec in records:
                    row = {FIELD_MAP[k]: rec[k] for k in FIELD_MAP if k in rec}
                    row["date"] = date
                    row["market"] = market
                    rows.append(row)
                pbar.update(1)

    log_f.close()
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["date"] = pd.to_datetime(df["date"], format="%Y%m%d")
    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def write_partitioned(df: pd.DataFrame, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    df = df.assign(year=df["date"].dt.year)
    for year, group in df.groupby("year"):
        year_dir = out_dir / f"year={year}"
        year_dir.mkdir(parents=True, exist_ok=True)
        group.drop(columns=["year"]).to_parquet(
            year_dir / "part.parquet", index=False
        )
        logger.info("wrote %s rows to %s", len(group), year_dir)


def build_ticker_meta(df: pd.DataFrame, out_path: Path) -> None:
    latest = df.sort_values("date").groupby("ticker").last()[["name", "market"]]
    first_trade = df.groupby("ticker")["date"].min().rename("first_trade_date")
    last_trade = df.groupby("ticker")["date"].max().rename("last_trade_date")
    meta = latest.join(first_trade).join(last_trade).reset_index()
    meta["instrument_type"] = meta["name"].map(classify_instrument)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    meta.to_parquet(out_path, index=False)
    logger.info("wrote %s tickers to %s", len(meta), out_path)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default="2018-01-01")
    parser.add_argument("--end", default=pd.Timestamp.today().strftime("%Y-%m-%d"))
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--data-dir", default="data/raw")
    args = parser.parse_args()

    auth_key = os.getenv("KRX_OPENAPI_KEY")
    if not auth_key:
        raise SystemExit("KRX_OPENAPI_KEY not set in .env")

    client = KRXOpenAPIClient(auth_key=auth_key, sleep_seconds=args.sleep)
    dates = business_days(args.start, args.end)
    logger.info("fetching %d business days x %d markets = %d calls",
                len(dates), len(MARKETS), len(dates) * len(MARKETS))

    Path("logs").mkdir(exist_ok=True)
    log_path = Path("logs/fetch_log.jsonl")
    df = fetch_all(client, dates, log_path)

    if df.empty:
        logger.error("no data fetched -- aborting write")
        raise SystemExit(1)

    data_dir = Path(args.data_dir)
    write_partitioned(df, data_dir / "daily_price")
    build_ticker_meta(df, data_dir / "ticker_meta" / "ticker_meta.parquet")

    logger.info("done. %d total rows, %d unique tickers, date range %s ~ %s",
                len(df), df["ticker"].nunique(), df["date"].min().date(), df["date"].max().date())


if __name__ == "__main__":
    main()
