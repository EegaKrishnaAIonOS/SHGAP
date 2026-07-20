from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.transliteration import TransliterationError

client = TestClient(app)


def test_transliterate_returns_the_normalized_text():
    with patch(
        "app.main.text_normalizer.normalize",
        new=AsyncMock(return_value="నేను మామిడి పికల్ రెజిస్టర్ చేయాలి"),
    ):
        response = client.post(
            "/transliterate", json={"text": "nenu mamidi pickle register cheyali"}
        )

    assert response.status_code == 200
    assert response.json() == {"text": "నేను మామిడి పికల్ రెజిస్టర్ చేయాలి"}


def test_transliterate_falls_back_to_the_original_text_on_error():
    with patch(
        "app.main.text_normalizer.normalize",
        new=AsyncMock(side_effect=TransliterationError("boom")),
    ):
        response = client.post("/transliterate", json={"text": "some input"})

    assert response.status_code == 200
    assert response.json() == {"text": "some input"}


def test_transliterate_rejects_a_missing_text_field():
    response = client.post("/transliterate", json={})
    assert response.status_code == 422
