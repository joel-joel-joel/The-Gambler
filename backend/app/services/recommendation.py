from __future__ import annotations

from typing import Optional

POSITION_CATEGORY: dict[str, str] = {
    "UTG": "early", "UTG+1": "early", "UTG+2": "early",
    "MP": "middle", "MP+1": "middle",
    "CO": "late", "BTN": "late",
    "SB": "blind", "BB": "blind",
}

POSITION_ORDER: list[str] = [
    "UTG", "UTG+1", "UTG+2", "MP", "MP+1", "CO", "BTN", "SB", "BB",
]

POSITIONS_BY_SIZE: dict[int, list[str]] = {
    2: ["SB", "BB"],
    3: ["BTN", "SB", "BB"],
    4: ["CO", "BTN", "SB", "BB"],
    5: ["MP", "CO", "BTN", "SB", "BB"],
    6: ["UTG", "MP", "CO", "BTN", "SB", "BB"],
    7: ["UTG", "UTG+1", "MP", "CO", "BTN", "SB", "BB"],
    8: ["UTG", "UTG+1", "MP", "MP+1", "CO", "BTN", "SB", "BB"],
    9: ["UTG", "UTG+1", "UTG+2", "MP", "MP+1", "CO", "BTN", "SB", "BB"],
}

EQUITY_ADJUST_BASE: dict[str, float] = {
    "early": -0.08,
    "middle": -0.03,
    "late": 0.05,
    "blind": 0.0,
}


def _players_behind(position: str, table_size: int) -> int:
    """Count how many seats are behind this position (haven't acted yet preflop)."""
    seats = POSITIONS_BY_SIZE.get(table_size, POSITIONS_BY_SIZE.get(6, []))
    if position not in seats:
        return 0
    idx = seats.index(position)
    # Preflop action goes UTG→...→BTN→SB→BB, so players behind = everyone after idx
    # But SB and BB have already posted, so they're "behind" but committed
    return len(seats) - idx - 1


def _compute_preflop_adjustment(
    position: Optional[str],
    table_size: int,
    active_players: int,
) -> float:
    """Compute equity adjustment for preflop based on position and table dynamics."""
    if not position:
        return 0.0

    pos_cat = POSITION_CATEGORY.get(position, "middle")
    base_adj = EQUITY_ADJUST_BASE[pos_cat]

    behind = _players_behind(position, table_size)

    # More players behind = tighter (they might raise/squeeze)
    # Each player behind adds -1% adjustment (up to -4%)
    behind_penalty = min(behind * 0.01, 0.04)

    # If many have already folded, the remaining players likely have stronger hands
    # folded_before_you = table_size - active_players (approx)
    folded = max(0, table_size - active_players - 1)  # -1 for yourself
    # More folds before you = remaining players are stronger, play tighter
    strength_penalty = min(folded * 0.015, 0.04)

    return base_adj - behind_penalty - strength_penalty


def recommend(
    equity: float,
    equity_required: float,
    ev_call: float,
    spr: float,
    street: str,
    outs: int,
    pot_size: float = 0,
    bet_to_call: float = 0,
    position: Optional[str] = None,
    table_size: int = 0,
    active_players: int = 0,
) -> tuple[str, str, dict | None]:
    """Return (action, reason, raise_info)."""

    is_check = bet_to_call == 0

    if street == "preflop" and table_size > 0:
        adj = _compute_preflop_adjustment(position, table_size, active_players)
    else:
        adj = 0.0
    effective_equity = equity + adj

    if is_check or (ev_call > 0 and effective_equity > equity_required):
        if effective_equity > 0.70:
            action = "RAISE"
            reason = "Strong hand — build the pot"
        elif effective_equity > 0.55:
            action = "RAISE"
            reason = "Good equity — apply pressure"
        elif spr < 3 and effective_equity > 0.45:
            action = "RAISE"
            reason = "Low SPR — you're committed, get it in"
        elif is_check:
            return "CHECK", "No bet to call — check is free", None
        else:
            return "CALL", "+EV call but not strong enough to raise", None
    elif effective_equity > equity_required * 0.85:
        return "CALL", "Borderline — consider implied odds and position", None
    elif outs >= 9 and street == "flop":
        return "CALL", f"Drawing hand with {outs} outs (~{outs*4}%). Consider implied odds", None
    else:
        return "FOLD", f"Need {equity_required:.0%} equity, only have {equity:.0%}", None

    raise_info = _compute_raise_sizing(equity, pot_size, bet_to_call, spr, street)
    return action, reason, raise_info


def _compute_raise_sizing(
    equity: float,
    pot_size: float,
    bet_to_call: float,
    spr: float,
    street: str,
) -> dict:
    effective_pot = pot_size + bet_to_call

    if spr < 3:
        return {
            "sizing": "all-in",
            "amount": None,
            "reasoning": "Low SPR — push all-in",
        }

    if equity > 0.70:
        pct = 0.75
        label = "75% pot (value bet)"
    elif equity > 0.55:
        pct = 0.50
        label = "50% pot (standard bet)"
    else:
        pct = 0.33
        label = "33% pot (small bet / blocker)"

    amount = round(effective_pot * pct, 0)
    if amount < 1:
        amount = 1

    return {
        "sizing": label,
        "amount": amount,
        "reasoning": f"Raise to ${amount:.0f} ({pct:.0%} of ${effective_pot:.0f} pot)",
    }
