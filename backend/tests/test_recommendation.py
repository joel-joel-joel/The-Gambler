from app.services.recommendation import recommend


def test_strong_hand_raises():
    action, reason = recommend(
        equity=0.75, equity_required=0.25, ev_call=50.0, spr=5.0, street="flop", outs=0
    )
    assert action == "RAISE"


def test_good_equity_raises():
    action, reason = recommend(
        equity=0.60, equity_required=0.30, ev_call=25.0, spr=5.0, street="flop", outs=0
    )
    assert action == "RAISE"


def test_low_spr_committed():
    action, reason = recommend(
        equity=0.48, equity_required=0.30, ev_call=15.0, spr=2.5, street="flop", outs=0
    )
    assert action == "RAISE"


def test_positive_ev_calls():
    action, reason = recommend(
        equity=0.38, equity_required=0.30, ev_call=10.0, spr=8.0, street="flop", outs=0
    )
    assert action == "CALL"


def test_borderline_calls():
    action, reason = recommend(
        equity=0.27, equity_required=0.30, ev_call=-2.0, spr=6.0, street="flop", outs=4
    )
    assert action == "CALL"


def test_drawing_hand_calls():
    action, reason = recommend(
        equity=0.20, equity_required=0.33, ev_call=-5.0, spr=8.0, street="flop", outs=9
    )
    assert action == "CALL"


def test_weak_hand_folds():
    action, reason = recommend(
        equity=0.12, equity_required=0.33, ev_call=-20.0, spr=8.0, street="turn", outs=2
    )
    assert action == "FOLD"
