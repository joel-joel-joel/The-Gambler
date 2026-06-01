"""Comprehensive tests for detect_outs — every draw type and combo."""

from app.services.poker_engine import detect_outs


def _has_draw(result: dict, draw_type: str) -> bool:
    return any(d["draw_type"] == draw_type for d in result["draws"])


def _draw_outs(result: dict, draw_type: str) -> int:
    for d in result["draws"]:
        if d["draw_type"] == draw_type:
            return d["outs"]
    return 0


def _has_description(result: dict, draw_type: str) -> bool:
    for d in result["draws"]:
        if d["draw_type"] == draw_type:
            return bool(d.get("description"))
    return False


# --- Pure flush draw ---

def test_flush_draw_9_outs():
    result = detect_outs(["Ah", "Kh"], ["7h", "2h", "9c"])
    assert _has_draw(result, "flush_draw")
    assert _draw_outs(result, "flush_draw") == 9
    assert _has_description(result, "flush_draw")


# --- Pure OESD ---

def test_oesd_8_outs():
    # J-T on 9-8 board = need 7 or Q
    result = detect_outs(["Jh", "Td"], ["9c", "8d", "2h"])
    assert _has_draw(result, "open_ended_straight")
    assert _draw_outs(result, "open_ended_straight") == 8
    assert _has_description(result, "open_ended_straight")


# --- Pure gutshot ---

def test_gutshot_4_outs():
    # A-K on Q-J-5 = need T for broadway
    result = detect_outs(["Ah", "Kd"], ["Qc", "Jd", "5h"])
    assert _has_draw(result, "gutshot_straight")
    assert _draw_outs(result, "gutshot_straight") == 4
    assert _has_description(result, "gutshot_straight")


# --- Double gutshot ---

def test_double_gutshot_8_outs():
    # 9-7 on T-6-3 board: need 8 (6-7-8-9-T) or 5 (3-...-7? no)
    # Better example: J-9 on T-7-3: need 8 (7-8-9-T-J) and Q (9-T-J-Q-?)
    # Actually: 8-6 on 9-5-3: need 7 (5-6-7-8-9) and 4 (3-4-5-6-7? wait 8 not in that)
    # Clearest: T-8 on J-6-4:
    #   Window 4-8 (values 2-6): have 2(4),4(6),6(8) = 3, no
    # Let me use: 9h 7d on Ts 6c 3h
    #   Ranks: 3,6,7,9,T → values: 1,4,5,7,8
    #   Window 4-8: {4,5,6,7,8} present={4,5,7,8} missing={6}=rank 8 → gutshot
    #   Window 3-7: {3,4,5,6,7} present={4,5,7} missing={3,6} → only 3/5, skip
    #   Window 5-9: {5,6,7,8,9} present={5,7,8} missing={6,9} → only 3/5, skip
    #   Hmm only one gutshot. Let me pick a better hand.
    # Double gutshot: 5d on Qh 9c 7s 3d with hole Th 8d
    #   Ranks: T,8,Q,9,7,3 → values: 8,6,10,7,5,1
    #   Window 5-9: {5,6,7,8,9} present={5,6,7,8} missing={9}=rank J? No, value 9=J.
    #     Wait value 5=7, 6=8, 7=9, 8=T. present={5(7),6(8),7(9),8(T)} = 4. missing={9}=J → gutshot 1
    #   Window 6-10: {6,7,8,9,10} present={6(8),7(9),8(T),10(Q)} = 4. missing={9}=J → same J
    #   Hmm same missing rank.
    # I'll test the double gutshot detection with a known example:
    # 6h 4d on 8c 3s 2d: values 4,2,6,1,0
    #   Window -1 to 3: {-1,0,1,2,3} → have {0(2),1(3),2(4)} = 3, no
    #   Window 0-4: {0,1,2,3,4} → have {0,1,2,4} missing {3}=5 → gutshot
    #   Window 2-6: {2,3,4,5,6} → have {2,4,6} = 3, no
    # Only one gutshot here too. Double gutshots are rare.
    # Classic double gutshot: 8-5 on 9-6-3 (or similar)
    # Ranks 8,5,9,6,3 → values 6,3,7,4,1
    #   Window 1-5: {1,2,3,4,5} → have {1(3),3(5),4(6)} = 3, no
    #   Window 2-6: {2,3,4,5,6} → have {3(5),4(6),6(8)} = 3, no
    #   Window 3-7: {3,4,5,6,7} → have {3,4,6,7} missing {5}=7 → gutshot
    #   Window 4-8: {4,5,6,7,8} → have {4,6,7} = 3, no
    # Still just one. A true double gutshot needs specific structures.
    # T-8 on Q-9-6-3: ranks T,8,Q,9,6,3 → values 8,6,10,7,4,1
    #   Window 4-8: {4,5,6,7,8} → have {4(6),6(8),7(9),8(T)} = 4, missing {5}=7 → gutshot
    #   Window 6-10: {6,7,8,9,10} → have {6(8),7(9),8(T),10(Q)} = 4, missing {9}=J → gutshot
    # YES! Two different missing ranks: 7 and J
    result = detect_outs(["Th", "8d"], ["Qc", "9s", "6h", "3d"])
    assert _has_draw(result, "double_gutshot")
    assert _draw_outs(result, "double_gutshot") == 8


# --- Overcards ---

def test_overcards_one():
    # Ah 3d on 7c 5d 2h — A is overcard, 3 is not
    result = detect_outs(["Ah", "3d"], ["7c", "5d", "2h"])
    assert _has_draw(result, "overcards")
    assert _draw_outs(result, "overcards") == 3


def test_overcards_two():
    # AK on low board
    result = detect_outs(["Ah", "Kd"], ["7c", "5d", "2h"])
    assert _has_draw(result, "overcards")
    assert _draw_outs(result, "overcards") == 6


def test_no_overcards_when_board_higher():
    # 2s 3d on Ac Kh Qd — no overcards
    result = detect_outs(["2s", "3d"], ["Ac", "Kh", "Qd"])
    assert not _has_draw(result, "overcards")


# --- Overcards WITH flush/straight draws (the bug fix) ---

def test_flush_draw_plus_overcards():
    # Ah Kh on 7h 2h 9c — flush draw (9) + 2 overcards (6) = 15
    result = detect_outs(["Ah", "Kh"], ["7h", "2h", "9c"])
    assert _has_draw(result, "flush_draw")
    assert _has_draw(result, "overcards")
    assert result["total_outs"] == 15


def test_gutshot_plus_overcards():
    # AK on Q-J-5: gutshot (4 for T) + 1 overcard (3 for A, K not overcard since Q<K wait K>Q so K is overcard? no)
    # Board max is Q (value 10). A (12) > Q, K (11) > Q. Both overcards.
    # But wait, A and K are not on board so they count. 6 overcard outs + 4 gutshot = 10
    result = detect_outs(["Ah", "Kd"], ["Qc", "Jd", "5h"])
    assert _has_draw(result, "gutshot_straight")
    assert _has_draw(result, "overcards")
    assert result["total_outs"] == 10


# --- The user's exact example ---

def test_user_example_flush_gutshot_overcard():
    # 8d Ac on Jd 3c Tc 7c
    # Flush: 4 clubs (Ac, 3c, Tc, 7c) → 9 club outs
    # Gutshot: 7-8-?-T-J needs 9 → 4 nines
    # Overcard: A > J (board max) → 3 aces
    # Total: 9 + 4 + 3 = 16
    result = detect_outs(["8d", "Ac"], ["Jd", "3c", "Tc", "7c"])
    assert _has_draw(result, "flush_draw")
    assert _draw_outs(result, "flush_draw") == 9
    assert _has_draw(result, "gutshot_straight")
    assert _draw_outs(result, "gutshot_straight") == 4
    assert _has_draw(result, "overcards")
    assert _draw_outs(result, "overcards") == 3
    assert result["total_outs"] == 16


# --- Pair-to-trips ---

def test_paired_hole_card_trips():
    # Jd 6h on 5s Jc 9c — J pairs board, 2 remaining Jacks
    result = detect_outs(["Jd", "6h"], ["5s", "Jc", "9c"])
    assert _has_draw(result, "trips_draw")
    assert _draw_outs(result, "trips_draw") == 2


# --- Pocket pair to set ---

def test_pocket_pair_set_draw():
    # 9s 9h on Ac 5d 2h — 2 remaining 9s
    result = detect_outs(["9s", "9h"], ["Ac", "5d", "2h"])
    assert _has_draw(result, "set_draw")
    assert _draw_outs(result, "set_draw") == 2


# --- Monster combo draws ---

def test_flush_plus_oesd():
    # Jh Th on 9h 8h 2c — flush (9) + OESD (8) = 17
    result = detect_outs(["Jh", "Th"], ["9h", "8h", "2c"])
    assert _has_draw(result, "flush_draw")
    assert _has_draw(result, "open_ended_straight")
    assert result["total_outs"] >= 17


def test_flush_plus_oesd_plus_overcards():
    # Ah Kh on Qh 3h 5c — flush (9) + no OESD, but check if overcard
    # Board max Q (10). A (12) > Q, K (11) > Q → 2 overcards (6)
    # No straight draw. Total = 9 + 6 = 15
    result = detect_outs(["Ah", "Kh"], ["Qh", "3h", "5c"])
    assert _has_draw(result, "flush_draw")
    assert _has_draw(result, "overcards")
    assert result["total_outs"] == 15


# --- River = no outs ---

def test_river_zero_outs():
    result = detect_outs(["Ah", "Kd"], ["7c", "5d", "2h", "9s", "Jc"])
    assert result["total_outs"] == 0
    assert result["draws"] == []


# --- Dry board with low cards (minimal outs) ---

def test_dry_board_low_cards():
    # 2s 3d on Ac Kh Qd Jc — gutshot (need T for broadway straight: T-J-Q-K-A)
    result = detect_outs(["2s", "3d"], ["Ac", "Kh", "Qd", "Jc"])
    assert _has_draw(result, "gutshot_straight")
    assert _draw_outs(result, "gutshot_straight") == 4
    assert not _has_draw(result, "overcards")


# --- All draws have descriptions ---

def test_all_draws_have_descriptions():
    # Monster draw: should produce multiple draws all with descriptions
    result = detect_outs(["8d", "Ac"], ["Jd", "3c", "Tc", "7c"])
    for draw in result["draws"]:
        assert "description" in draw, f"Missing description in {draw['draw_type']}"
        assert len(draw["description"]) > 0


# --- Cap at 20 ---

def test_outs_capped_at_20():
    # Extreme combo draw that might exceed 20
    # Flush (9) + OESD (8) + overcards would be 17+, but cap at 20
    result = detect_outs(["Ah", "Kh"], ["Qh", "Jh", "Tc"])
    # Flush (9) + OESD or straight + overcards
    assert result["total_outs"] <= 20
