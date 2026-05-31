def recommend(
    equity: float,
    equity_required: float,
    ev_call: float,
    spr: float,
    street: str,
    outs: int,
) -> tuple[str, str]:
    if ev_call > 0 and equity > equity_required:
        if equity > 0.70:
            return "RAISE", "Strong hand — build the pot"
        elif equity > 0.55:
            return "RAISE", "Good equity — apply pressure"
        elif spr < 3 and equity > 0.45:
            return "RAISE", "Low SPR — you're committed, get it in"
        else:
            return "CALL", "+EV call but not strong enough to raise"
    elif equity > equity_required * 0.85:
        return "CALL", "Borderline — consider implied odds and position"
    elif outs >= 9 and street == "flop":
        return "CALL", f"Drawing hand with {outs} outs (~{outs*4}%). Consider implied odds"
    else:
        return "FOLD", f"Need {equity_required:.0%} equity, only have {equity:.0%}"
