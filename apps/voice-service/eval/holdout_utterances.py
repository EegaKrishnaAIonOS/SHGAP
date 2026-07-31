# T23 evaluation — a genuinely new set, never used while writing app/bot.py's
# system prompt or T11's own test_utterances.py, so a good result here says
# something T11's own tuning set can't: that the ≥90% target generalizes to
# phrasing nobody iterated against, not just to sentences the prompt/tool
# schemas were implicitly shaped around. Same categories and same
# {text, language, expected_tool} shape as test_utterances.py (see
# run_intent_eval.py / run_stt_wer_eval.py) so both eval scripts work
# unchanged against either set.

TEST_UTTERANCES = [
    # --- register_product ---
    {
        "text": "అరటిపండ్ల చిప్స్ కొత్తగా యాడ్ చేయాలి, ఒక్కో పాకెట్‌కి 60 రూపాయలు",
        "language": "te",
        "expected_tool": "register_product",
    },
    {
        "text": "Please add a new listing for turmeric powder, 200 rupees per kg",
        "language": "en",
        "expected_tool": "register_product",
    },
    {
        "text": "ఒక కొత్త వస్తువు నమోదు చేయాలి, పేరు కొబ్బరి నూనె, లీటర్‌కి 220 రూపాయలు",
        "language": "te",
        "expected_tool": "register_product",
    },
    {
        "text": "Can you list my new product, dried red chillies, price 300 per kg",
        "language": "en",
        "expected_tool": "register_product",
    },
    # --- check_product_price ---
    {
        "text": "నా అరటిపండ్ల చిప్స్ ఇప్పుడు ఎంతకు అమ్ముతున్నాను?",
        "language": "te",
        "expected_tool": "check_product_price",
    },
    {
        "text": "How much stock do I have left for turmeric powder?",
        "language": "en",
        "expected_tool": "check_product_price",
    },
    {
        "text": "కొబ్బరి నూనె ధర, స్టాక్ ఎంత ఉందో చెప్పు",
        "language": "te",
        "expected_tool": "check_product_price",
    },
    # --- out of scope: market/price enquiry beyond own listings ---
    {
        "text": "పక్క గ్రామంలో SHG వాళ్లు కారప్పొడి ఎంతకు అమ్ముతున్నారు?",
        "language": "te",
        "expected_tool": None,
    },
    {
        "text": "What's the going rate for cotton sarees in the wholesale market right now?",
        "language": "en",
        "expected_tool": None,
    },
    # --- out of scope: buyer search ---
    {
        "text": "నా ఉత్పత్తులు కొనడానికి ఎవరైనా ఆసక్తి చూపిస్తున్నారా?",
        "language": "te",
        "expected_tool": None,
    },
    {
        "text": "Can you connect me with a buyer for bamboo baskets?",
        "language": "en",
        "expected_tool": None,
    },
    # --- out of scope: scheme guidance ---
    {
        "text": "SHGలకు రుణాలు ఎలా వస్తాయి?",
        "language": "te",
        "expected_tool": None,
    },
    {
        "text": "Tell me about any subsidy schemes for handloom workers",
        "language": "en",
        "expected_tool": None,
    },
    # --- out of scope: general chit-chat ---
    {
        "text": "ఈ రోజు వాతావరణం ఎలా ఉంది?",
        "language": "te",
        "expected_tool": None,
    },
    {
        "text": "Thank you, that's all for now",
        "language": "en",
        "expected_tool": None,
    },
]
