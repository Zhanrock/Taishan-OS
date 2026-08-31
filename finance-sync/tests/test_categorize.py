from categorize import categorize, strip_legal_suffix


def test_strip_legal_suffix_pte_ltd():
    assert strip_legal_suffix("POKKA PTE LTD") == "POKKA"


def test_strip_legal_suffix_pte_dot_ltd_dot():
    assert strip_legal_suffix("NTUC FAIRPRICE PTE. LTD.") == "NTUC FAIRPRICE"


def test_categorize_matches_after_suffix_strip():
    assert categorize("POKKA PTE LTD") == "food"


def test_categorize_singapore_merchants():
    assert categorize("NTUC FAIRPRICE SINGAPORE") == "groceries"
    assert categorize("SINGTEL MOBILE") == "bills"
    assert categorize("GRAB* RIDE") == "transport"


def test_categorize_unknown_falls_back():
    assert categorize("SOME RANDOM SHOP") == "uncategorized"
