"""
Parser registry. Add each new bank module here after creating it —
sync.py tries them in order and uses the first one whose matches() is True.
"""
from . import dbs, kasikorn

PARSERS = [
    dbs,
    kasikorn,
]
