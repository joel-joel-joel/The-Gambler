from app.services.poker_engine import (
    calculate_pot_odds,
    calculate_pot_odds_ratio,
    calculate_ev,
    calculate_spr,
    calculate_mdf,
    calculate_bluff_break_even,
    calculate_fold_equity,
    calculate_effective_stack,
    rule_of_2_4,
    detect_outs,
)


def test_pot_odds_percentage():
    result = calculate_pot_odds(bet_to_call=20, pot_size=100)
    assert abs(result - 16.67) < 0.01


def test_pot_odds_ratio():
    result = calculate_pot_odds_ratio(bet_to_call=20, pot_size=100)
    assert result == "6:1"


def test_ev_positive():
    # EV = (0.40 × 150) - (0.60 × 50) = 60 - 30 = 30
    result = calculate_ev(equity=0.40, pot_size=100, bet_to_call=50)
    assert abs(result - 30.0) < 0.01


def test_ev_negative():
    result = calculate_ev(equity=0.15, pot_size=100, bet_to_call=50)
    assert result < 0


def test_spr():
    result = calculate_spr(effective_stack=200, pot_size=50)
    assert result == 4.0


def test_spr_zero_pot():
    result = calculate_spr(effective_stack=200, pot_size=0)
    assert result == float("inf")


def test_mdf():
    result = calculate_mdf(bet_size=100, pot_size=100)
    assert abs(result - 0.50) < 0.01


def test_bluff_break_even():
    result = calculate_bluff_break_even(bluff_size=75, pot_size=100)
    assert abs(result - 0.4286) < 0.01


def test_fold_equity():
    result = calculate_fold_equity(fold_probability=0.40, pot_size=100)
    assert abs(result - 40.0) < 0.01


def test_effective_stack():
    result = calculate_effective_stack(your_stack=500, villain_stack=300, bb=2)
    assert result["effective_stack"] == 300
    assert result["effective_stack_bb"] == 150
    assert result["stack_depth"] == "deep"


def test_effective_stack_short():
    result = calculate_effective_stack(your_stack=40, villain_stack=500, bb=2)
    assert result["effective_stack"] == 40
    assert result["effective_stack_bb"] == 20
    assert result["stack_depth"] == "short"


def test_rule_of_4_flop():
    result = rule_of_2_4(outs=9, street="flop")
    assert result == 36.0


def test_rule_of_2_turn():
    result = rule_of_2_4(outs=9, street="turn")
    assert result == 18.0


def test_rule_of_2_4_cap():
    result = rule_of_2_4(outs=30, street="flop")
    assert result == 100.0


def test_flush_draw_outs():
    hole = ["Ah", "Kh"]
    board = ["7h", "2h", "9c"]
    result = detect_outs(hole, board)
    assert result["total_outs"] == 9
    assert any(d["draw_type"] == "flush_draw" for d in result["draws"])


def test_open_ended_straight_draw():
    hole = ["Jh", "Td"]
    board = ["9c", "8d", "2h"]
    result = detect_outs(hole, board)
    assert any(d["draw_type"] == "open_ended_straight" for d in result["draws"])
    straight_draw = next(
        d for d in result["draws"] if d["draw_type"] == "open_ended_straight"
    )
    assert straight_draw["outs"] == 8


def test_gutshot_straight_draw():
    hole = ["Ah", "Kd"]
    board = ["Qc", "Jd", "5h"]
    result = detect_outs(hole, board)
    assert any(d["draw_type"] == "gutshot_straight" for d in result["draws"])


def test_overcards():
    hole = ["Ah", "Kd"]
    board = ["7c", "5d", "2h"]
    result = detect_outs(hole, board)
    assert any(d["draw_type"] == "overcards" for d in result["draws"])
    overcard_draw = next(
        d for d in result["draws"] if d["draw_type"] == "overcards"
    )
    assert overcard_draw["outs"] == 6


def test_no_draws_on_river():
    hole = ["Ah", "Kd"]
    board = ["7c", "5d", "2h", "9s", "Jc"]
    result = detect_outs(hole, board)
    assert result["total_outs"] == 0


def test_combo_draw():
    # Flush draw (9) + open-ended straight draw (8) = 15+ outs (with overlap deduction)
    hole = ["Jh", "Th"]
    board = ["9h", "8h", "2c"]
    result = detect_outs(hole, board)
    # Should have both flush and straight draws, total >= 15
    assert result["total_outs"] >= 15
