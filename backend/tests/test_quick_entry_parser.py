"""Tests for the quick entry parser — shorthand notation → structured game state."""

from app.services.quick_entry_parser import parse_quick_entry


def test_basic_suited():
    result = parse_quick_entry("AKs 150 40")
    assert result["hole_cards"] is not None
    assert len(result["hole_cards"]) == 2
    assert result["pot_size"] == 150
    assert result["bet_to_call"] == 40


def test_specific_suits():
    result = parse_quick_entry("QhJd 200 75 btn")
    assert result["hole_cards"] == ["Qh", "Jd"]
    assert result["pot_size"] == 200
    assert result["bet_to_call"] == 75
    assert result["position"] == "BTN"


def test_pocket_pair():
    result = parse_quick_entry("99 80 20 6p")
    assert result["hole_cards"][0][0] == "9"
    assert result["hole_cards"][1][0] == "9"
    assert result["pot_size"] == 80
    assert result["bet_to_call"] == 20
    assert result["num_players"] == 6


def test_offsuit():
    result = parse_quick_entry("AKo 100 50")
    assert result["hole_cards"] is not None
    assert result["hole_cards"][0][1] != result["hole_cards"][1][1]


def test_position_parsing():
    for pos in ["btn", "co", "mp", "utg", "sb", "bb"]:
        result = parse_quick_entry(f"AKs 100 50 {pos}")
        assert result["position"] == pos.upper()


def test_confidence_high_with_specific_cards():
    result = parse_quick_entry("AhKd 100 50")
    assert result["confidence"] >= 0.95


def test_confidence_lower_with_assumptions():
    result = parse_quick_entry("AKs 100 50")
    assert result["confidence"] < 1.0
    assert len(result["assumptions"]) > 0


def test_empty_input():
    result = parse_quick_entry("")
    assert result["hole_cards"] is None
