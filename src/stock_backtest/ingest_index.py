"""Ingest KOSPI/KOSDAQ index daily OHLCV from KRX Open API into parquet.

Each date's response bundles several sub-indices (e.g. "코스피", "코스피
(외국주포함)", "코스피 200", ...) under IDX_NM -- we keep only the plain
market index, since that's what daily_price's excess-return signals compare
against.

Usage:
    uv run python -m stock_backtest.ingest_index
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from tqdm import tqdm

from stock_backtest.krx_openapi import KRXAuthError, KRXOpenAPIClient
from stock_backtest.ingest_daily import business_days

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("logs/ingest_index.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

MARKETS = ["KOSPI", "KOSDAQ"]
# the single plain-market-index name to keep, per market
TARGET_INDEX_NAME = {"KOSPI": "코스피", "KOSDAQ": "코스닥"}

FIELD_MAP = {
    "OPNPRC_IDX": "open",
    "HGPRC_IDX": "high",
    "LWPRC_IDX": "low",
    "CLSPRC_IDX": "close",
    "ACC_TRDVOL": "volume",
    "ACC_TRDVAL": "trade_value",
}
NUMERIC_COLS = ["open", "high", "low", "close", "volume", "trade_value"]


def fetch_all(client: KRXOpenAPIClient, dates: list[str]) -> pd.DataFrame:
    rows: list[dict] = []
    total = len(dates) * len(MARKETS)
    with tqdm(total=total, desc="fetching KRX index daily") as pbar:
        for date in dates:
            for market in MARKETS:
                try:
                    records = client.get_index_daily(market, date)
                except KRXAuthError as exc:
                    logger.error("auth error for %s %s: %s -- aborting", market, date, exc)
                    raise
                except Exception as exc:  # noqa: BLE001
                    logger.error("failed %s %s: %s", market, date, exc)
                    pbar.update(1)
                    continue

                target = TARGET_INDEX_NAME[market]
                for rec in records:
                    if rec.get("IDX_NM") != target:
                        continue
                    row = {FIELD_MAP[k]: rec[k] for k in FIELD_MAP if k in rec}
                    row["date"] = date
                    row["market"] = market
                    rows.append(row)
                pbar.update(1)

    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["date"] = pd.to_datetime(df["date"], format="%Y%m%d")
    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default="2018-01-01")
    parser.add_argument("--end", default=pd.Timestamp.today().strftime("%Y-%m-%d"))
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--out", default="data/raw/index_price/index_price.parquet")
    args = parser.parse_args()

    auth_key = os.getenv("KRX_OPENAPI_KEY")
    if not auth_key:
        raise SystemExit("KRX_OPENAPI_KEY not set in .env")

    client = KRXOpenAPIClient(auth_key=auth_key, sleep_seconds=args.sleep)
    dates = business_days(args.start, args.end)
    logger.info("fetching %d business days x %d markets = %d calls",
                len(dates), len(MARKETS), len(dates) * len(MARKETS))

    df = fetch_all(client, dates)
    if df.empty:
        logger.error("no data fetched -- aborting write")
        raise SystemExit(1)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_path, index=False)
    logger.info("wrote %d rows to %s (date range %s ~ %s)",
                len(df), out_path, df["date"].min().date(), df["date"].max().date())


if __name__ == "__main__":
    main()
