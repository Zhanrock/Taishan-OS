import os
import sys

# Let tests import parsers/, categorize.py, sync.py etc. as top-level modules
# regardless of the directory pytest is invoked from.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
