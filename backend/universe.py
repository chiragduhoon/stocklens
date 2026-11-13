"""Official Nifty 50 constituent identifiers (pinned snapshot). Market data comes from market_data.py or, in demo mode, seed.py."""
import csv
from pathlib import Path

SOURCE_URL = 'https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv'
CHECKED_ON = '2026-10-30'
FIXTURE = Path(__file__).parent / 'fixtures' / 'nifty50_constituents.csv'
with FIXTURE.open(encoding='utf-8-sig', newline='') as stream:
    CONSTITUENTS = list(csv.DictReader(stream))
if len(CONSTITUENTS) != 50 or len({r['Symbol'] for r in CONSTITUENTS}) != 50:
    raise RuntimeError('The pinned Nifty 50 snapshot must contain 50 unique symbols.')
BY_SYMBOL = {r['Symbol']: r for r in CONSTITUENTS}

def _demo():
    import os
    return os.getenv('STOCKLENS_DATA', 'real').strip().lower() == 'demo'

def metadata():
    return {
        'name': 'Nifty 50', 'count': len(CONSTITUENTS),
        'constituents_checked_on': CHECKED_ON, 'source_url': SOURCE_URL,
        'financial_data': 'Generated demonstration data, not company filings' if _demo() else 'Reported figures via Yahoo Finance (latest available quarter per company)',
        'period': 'Q2 FY27 (simulated)' if _demo() else 'Latest reported quarter',
    }
