from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_calculate_endpoint():
    response = client.post(
        "/api/calculate",
        json={
            "hole_cards": ["Ah", "Kd"],
            "community_cards": ["7h", "2d", "9c"],
            "num_players": 2,
            "pot_size": 100,
            "bet_to_call": 50,
            "position": "CO",
            "your_stack": 500,
            "villain_stack": 500,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "equity" in data
    assert "ev" in data
    assert "pot_odds" in data
    assert "pot_odds_ratio" in data
    assert "equity_required" in data
    assert "outs" in data
    assert "rule_of_2_4" in data
    assert "recommendation" in data
    assert "spr" in data
    assert "mdf" in data
    assert data["recommendation"]["action"] in ["CALL", "RAISE", "FOLD"]


def test_calculate_preflop():
    response = client.post(
        "/api/calculate",
        json={
            "hole_cards": ["Ah", "Kd"],
            "community_cards": [],
            "num_players": 6,
            "pot_size": 15,
            "bet_to_call": 10,
            "position": "BTN",
            "your_stack": 200,
            "villain_stack": 200,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["preflop_hand_tier"] is not None


def test_parse_quick_entry_endpoint():
    response = client.post(
        "/api/parse-quick-entry",
        json={"input": "AKs 150 40 btn"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["hole_cards"] is not None
    assert data["pot_size"] == 150
    assert data["bet_to_call"] == 40
    assert data["position"] == "BTN"
