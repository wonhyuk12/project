"""KRX Open API (openapi.krx.co.kr) client.

Official, ToS-compliant path — NOT the data.krx.co.kr site-login scraping
pykrx uses. See project notes: that scraping route got this account's IP
1-day-blocked for "automated bulk collection" (KDM 이용약관 제10조 제2호 위반).

Endpoint discovery: openapi.krx.co.kr's own docs don't publish the base URL
plainly; confirmed by reading github.com/aaron-jang/krx-reader's source
(EndpointId.kt, KrxClient.kt, SnapshotFetcher.kt) and verified live against
this project's own API key on 2026-09-01.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://data-dbg.krx.co.kr/svc/apis"

# market -> endpoint slug, for daily OHLCV ("일별매매정보")
STOCK_ENDPOINTS = {
    "KOSPI": "sto/stk_bydd_trd",
    "KOSDAQ": "sto/ksq_bydd_trd",
    "KONEX": "sto/knx_bydd_trd",
}

INDEX_ENDPOINTS = {
    "KOSPI": "idx/kospi_dd_trd",
    "KOSDAQ": "idx/kosdaq_dd_trd",
}


class KRXAuthError(RuntimeError):
    """AUTH_KEY missing/invalid, or the specific service isn't approved yet."""


class KRXOpenAPIClient:
    def __init__(
        self,
        auth_key: str,
        sleep_seconds: float = 0.2,
        max_retries: int = 5,
        backoff_base: float = 1.5,
        timeout: float = 15.0,
    ) -> None:
        if not auth_key:
            raise ValueError("KRX_OPENAPI_KEY is empty")
        self.auth_key = auth_key
        self.sleep_seconds = sleep_seconds
        self.max_retries = max_retries
        self.backoff_base = backoff_base
        self.timeout = timeout
        self.session = requests.Session()

    def _get(self, path: str, params: dict) -> dict:
        url = f"{BASE_URL}/{path}"
        headers = {"AUTH_KEY": self.auth_key}

        last_exc: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                resp = self.session.get(
                    url, headers=headers, params=params, timeout=self.timeout
                )
            except requests.RequestException as exc:
                last_exc = exc
                wait = self.backoff_base**attempt
                logger.warning(
                    "request error on %s %s (attempt %d/%d): %s -- retrying in %.1fs",
                    path, params, attempt + 1, self.max_retries, exc, wait,
                )
                time.sleep(wait)
                continue

            if resp.status_code == 401:
                raise KRXAuthError(
                    f"401 Unauthorized for {path} -- service not approved "
                    f"in openapi.krx.co.kr mypage, or key invalid/expired"
                )
            if resp.status_code == 200:
                time.sleep(self.sleep_seconds)
                return resp.json()

            # 429 / 5xx -> retry with backoff; anything else -> also retry,
            # a transient KRX-side error, but log loudly.
            wait = self.backoff_base**attempt
            logger.warning(
                "HTTP %d on %s %s (attempt %d/%d) -- retrying in %.1fs: %s",
                resp.status_code, path, params, attempt + 1, self.max_retries,
                wait, resp.text[:200],
            )
            time.sleep(wait)

        raise RuntimeError(
            f"giving up on {path} {params} after {self.max_retries} attempts"
        ) from last_exc

    def get_daily_trade(self, market: str, date: str) -> list[dict]:
        """market: KOSPI/KOSDAQ/KONEX. date: YYYYMMDD. Empty list on non-trading days."""
        path = STOCK_ENDPOINTS[market]
        data = self._get(path, {"basDd": date})
        return data.get("OutBlock_1", [])

    def get_index_daily(self, market: str, date: str) -> list[dict]:
        """market: KOSPI/KOSDAQ. date: YYYYMMDD."""
        path = INDEX_ENDPOINTS[market]
        data = self._get(path, {"basDd": date})
        return data.get("OutBlock_1", [])
