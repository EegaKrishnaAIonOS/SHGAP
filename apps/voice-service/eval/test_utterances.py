# T11 evaluation test set — representative SHG-voice-assistant utterances,
# each labeled with the tool the assistant should call (or `None` for
# out-of-scope requests it should decline). Used by both
# `run_intent_eval.py` (intent-routing accuracy) and `run_stt_wer_eval.py`
# (STT word-error-rate, using `text` as the ground truth reference).
#
# Deliberately small (not a claim of statistical rigor) — see the eval
# report (`docs/eval/T11-nlu-eval.md`) and ADR-0020 for what this test set
# can and can't tell us.

TEST_UTTERANCES = [
    # --- register_product ---
    {
        "text": "నేను మామిడి ఊరగాయ నమోదు చేయాలి, జార్‌కి 120 రూపాయలు",
        "language": "te",
        "expected_tool": "register_product",
    },
    {
        "text": "Register a new product: bamboo basket, price 250 rupees per piece",
        "language": "en",
        "expected_tool": "register_product",
    },
    {
        "text": "nాకు ఒక కొత్త ఉత్పత్తి యాడ్ చేయాలి, పేరు చింతపండు, ధర కిలోకి 80 రూపాయలు",
        "language": "te",
        "expected_tool": "register_product",
    },
    {
        "text": "I want to add cotton saree, unit piece, price 800",
        "language": "en",
        "expected_tool": "register_product",
    },
    {
        "text": "కొత్త ప్రొడక్ట్ పెట్టాలి, పేరు కారప్పొడి, జార్ ధర 150",
        "language": "te",
        "expected_tool": "register_product",
    },
    # --- check_product_price ---
    {
        "text": "నా మామిడి ఊరగాయ ధర ఎంత ఉంది?",
        "language": "te",
        "expected_tool": "check_product_price",
    },
    {
        "text": "What is the price and stock of my bamboo basket?",
        "language": "en",
        "expected_tool": "check_product_price",
    },
    {
        "text": "నా చింతపండు స్టాక్ ఎంత మిగిలింది?",
        "language": "te",
        "expected_tool": "check_product_price",
    },
    {
        "text": "Check the price of cotton saree in my listing",
        "language": "en",
        "expected_tool": "check_product_price",
    },
    # --- out of scope: market/price enquiry beyond own listings ---
    {
        "text": "వేరే SHGల్లో పికిల్స్ ధర ఎంత ఉంటుంది?",
        "language": "te",
        "expected_tool": None,
    },
    {
        "text": "What's the average market price for turmeric this month?",
        "language": "en",
        "expected_tool": None,
    },
    # --- out of scope: buyer search ---
    {
        "text": "నా ఉత్పత్తులు కొనేవాళ్లు ఎవరు ఉన్నారు?",
        "language": "te",
        "expected_tool": None,
    },
    {
        "text": "Find me a buyer for my products",
        "language": "en",
        "expected_tool": None,
    },
    # --- out of scope: scheme guidance ---
    {
        "text": "MEPMA పథకాల గురించి చెప్పండి",
        "language": "te",
        "expected_tool": None,
    },
    {
        "text": "What government schemes are available for SHGs?",
        "language": "en",
        "expected_tool": None,
    },
    # --- out of scope: general chit-chat ---
    {
        "text": "మీరు ఎలా ఉన్నారు?",
        "language": "te",
        "expected_tool": None,
    },
    {
        "text": "What can you help me with?",
        "language": "en",
        "expected_tool": None,
    },
]
