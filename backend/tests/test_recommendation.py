from app.services.recommendation import recommend


def test_strong_hand_raises():
    action, reason, raise_info = recommend(
        equity=0.75, equity_required=0.25, ev_call=50.0, spr=5.0, street="flop", outs=0, pot_size=100, bet_to_call=25
    )
    assert action == "RAISE"
    assert raise_info is not None
    assert raise_info["amount"] is not None


def test_good_equity_raises():
    action, reason, raise_info = recommend(
        equity=0.60, equity_required=0.30, ev_call=25.0, spr=5.0, street="flop", outs=0, pot_size=100, bet_to_call=30
    )
    assert action == "RAISE"
    assert raise_info is not None


def test_low_spr_committed():
    action, reason, raise_info = recommend(
        equity=0.48, equity_required=0.30, ev_call=15.0, spr=2.5, street="flop", outs=0, pot_size=100, bet_to_call=30
    )
    assert action == "RAISE"
    assert raise_info is not None
    assert raise_info["sizing"] == "all-in"


def test_positive_ev_calls():
    action, reason, raise_info = recommend(
        equity=0.38, equity_required=0.30, ev_call=10.0, spr=8.0, street="flop", outs=0, pot_size=100, bet_to_call=30
    )
    assert action == "CALL"
    assert raise_info is None


def test_borderline_calls():
    action, reason, raise_info = recommend(
        equity=0.27, equity_required=0.30, ev_call=-2.0, spr=6.0, street="flop", outs=4, pot_size=100, bet_to_call=30
    )
    assert action == "CALL"


def test_drawing_hand_calls():
    action, reason, raise_info = recommend(
        equity=0.20, equity_required=0.33, ev_call=-5.0, spr=8.0, street="flop", outs=9, pot_size=100, bet_to_call=50
    )
    assert action == "CALL"


def test_weak_hand_folds():
    action, reason, raise_info = recommend(
        equity=0.12, equity_required=0.33, ev_call=-20.0, spr=8.0, street="turn", outs=2, pot_size=100, bet_to_call=50
    )
    assert action == "FOLD"


def test_check_when_no_bet():
    action, reason, raise_info = recommend(
        equity=0.35, equity_required=0.0, ev_call=0.0, spr=8.0, street="flop", outs=4, pot_size=100, bet_to_call=0
    )
    assert action == "CHECK"
    assert raise_info is None


def test_raise_when_no_bet_strong_hand():
    action, reason, raise_info = recommend(
        equity=0.75, equity_required=0.0, ev_call=0.0, spr=5.0, street="flop", outs=0, pot_size=100, bet_to_call=0
    )
    assert action == "RAISE"
    assert raise_info is not None


def test_position_early_tightens_preflop():
    action_utg, _, _ = recommend(
        equity=0.38, equity_required=0.30, ev_call=5.0, spr=8.0,
        street="preflop", outs=0, pot_size=15, bet_to_call=10,
        position="UTG", table_size=6, active_players=6
    )
    action_btn, _, _ = recommend(
        equity=0.38, equity_required=0.30, ev_call=5.0, spr=8.0,
        street="preflop", outs=0, pot_size=15, bet_to_call=10,
        position="BTN", table_size=6, active_players=6
    )
    assert action_utg == "CALL" or action_utg == "FOLD"
    assert action_btn == "CALL" or action_btn == "RAISE"


def test_position_does_not_affect_postflop():
    action_utg, _, _ = recommend(
        equity=0.38, equity_required=0.30, ev_call=10.0, spr=8.0,
        street="flop", outs=0, pot_size=100, bet_to_call=30, position="UTG"
    )
    action_btn, _, _ = recommend(
        equity=0.38, equity_required=0.30, ev_call=10.0, spr=8.0,
        street="flop", outs=0, pot_size=100, bet_to_call=30, position="BTN"
    )
    assert action_utg == action_btn


def test_many_folds_tightens():
    # 9-player table, CO position, all 9 active (nobody folded yet)
    action_all, _, _ = recommend(
        equity=0.40, equity_required=0.30, ev_call=8.0, spr=8.0,
        street="preflop", outs=0, pot_size=15, bet_to_call=10,
        position="CO", table_size=9, active_players=9
    )
    # Same spot but only 4 active (5 folded — remaining players are strong)
    action_few, _, _ = recommend(
        equity=0.40, equity_required=0.30, ev_call=8.0, spr=8.0,
        street="preflop", outs=0, pot_size=15, bet_to_call=10,
        position="CO", table_size=9, active_players=4
    )
    # With many folds, system should be tighter (more likely to fold/call vs raise)
    assert action_all in ("CALL", "RAISE")
    assert action_few in ("CALL", "FOLD")


def test_players_behind_tightens():
    # UTG at 9-player table: 8 players behind
    action_utg9, _, _ = recommend(
        equity=0.42, equity_required=0.30, ev_call=10.0, spr=8.0,
        street="preflop", outs=0, pot_size=15, bet_to_call=10,
        position="UTG", table_size=9, active_players=9
    )
    # UTG at 4-player table: only 3 players behind
    action_utg4, _, _ = recommend(
        equity=0.42, equity_required=0.30, ev_call=10.0, spr=8.0,
        street="preflop", outs=0, pot_size=15, bet_to_call=10,
        position="CO", table_size=4, active_players=4
    )
    # UTG at full table should be tighter than CO at short table
    assert action_utg4 in ("CALL", "RAISE")
    assert action_utg9 in ("CALL", "FOLD")
