"""Checks that every URL in the datasets opens.

Run from the backend folder (needs internet):
    python -m catalog.link_check
It only sends ordinary page requests to the public URLs listed in the CSVs;
no user data is sent. Some official sites block automated requests or are
slow, so failures are reported for a human to check, not auto-deleted.
"""
import sys
from concurrent.futures import ThreadPoolExecutor

import httpx

from catalog.schema import SPECS
from catalog.validator import validate

HEADERS = {"User-Agent": "CareerCompassAI-LinkCheck/1.0 (student project; link verification)"}


def collect_urls(tables) -> dict[str, list[str]]:
    """url -> list of 'file:id' places that use it."""
    found: dict[str, list[str]] = {}
    for name, spec in SPECS.items():
        for row in tables.get(name, []):
            where = f"{name}:{row.get(spec.id_column or 'career_id', '?')}"
            for column in spec.urls:
                url = row.get(column, "")
                if url:
                    found.setdefault(url, []).append(where)
    return found


def check(url: str, client: httpx.Client, retries: int = 1) -> tuple[str, str]:
    try:
        # HEAD is lighter, but many sites reject it, so fall back to GET
        response = client.head(url)
        if response.status_code >= 400:
            response = client.get(url)
        if response.status_code < 400:
            return url, "ok"
        return url, f"HTTP {response.status_code}"
    except httpx.TimeoutException:
        # Government sites are sometimes slow for a moment; try once more
        if retries > 0:
            return check(url, client, retries - 1)
        return url, "timeout"
    except httpx.ConnectError as exc:
        if "CERTIFICATE_VERIFY_FAILED" in str(exc):
            # Some government sites send an incomplete certificate chain. Browsers
            # repair this automatically; Python doesn't. Confirm the page exists
            # (read-only request, nothing is sent) and report it as a warning.
            try:
                with httpx.Client(headers=HEADERS, timeout=20, follow_redirects=True, verify=False) as loose:
                    if loose.get(url).status_code < 400:
                        return url, "warn: reachable, but the site's certificate chain is incomplete"
            except httpx.HTTPError:
                pass
        return url, f"error: {type(exc).__name__}"
    except httpx.HTTPError as exc:
        return url, f"error: {type(exc).__name__}"


def main() -> int:
    report, tables = validate()
    if not report.ok:
        print("Fix validator errors first (python -m catalog.validator).")
        return 1
    urls = collect_urls(tables)
    print(f"Checking {len(urls)} unique URLs…")
    with httpx.Client(headers=HEADERS, timeout=20, follow_redirects=True) as client:
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda u: check(u, client), sorted(urls)))
    failed = [(url, status) for url, status in results if status != "ok" and not status.startswith("warn")]
    warned = [(url, status) for url, status in results if status.startswith("warn")]
    for url, status in results:
        label = "OK  " if status == "ok" else "WARN" if status.startswith("warn") else "FAIL"
        print(f"  {label} {url}  {'' if status == 'ok' else status}")
    for url, status in failed:
        print(f"\nFAIL {url} ({status}) used in: {', '.join(urls[url][:5])}")
    print(f"\n{len(results) - len(failed) - len(warned)} ok, {len(warned)} warning(s), {len(failed)} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
