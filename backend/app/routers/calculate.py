"""Calculate API router — poker math endpoints for The Gambler."""

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.services.poker_engine import (
    calculate_effective_stack,
    calculate_equity,
    calculate_ev,
    calculate_mdf,
    calculate_pot_odds,
    calculate_pot_odds_ratio,
    calculate_spr,
    detect_outs,
    get_preflop_hand_tier,
    rule_of_2_4,
)
from app.services.recommendation import recommend
from app.services.quick_entry_parser import parse_quick_entry

router = APIRouter()

STREET_MAP = {0: "preflop", 3: "flop", 4: "turn", 5: "river"}


class CalculateRequest(BaseModel):
    hole_cards: list[str]
    community_cards: list[str] = []
    num_players: int = 2
    table_size: int = 0
    pot_size: float = 0
    bet_to_call: float = 0
    position: Optional[str] = None
    your_stack: Optional[float] = None
    villain_stack: Optional[float] = None


class QuickEntryRequest(BaseModel):
    input: str


@router.post("/api/calculate")
def calculate(req: CalculateRequest):
    # Infer street from community card count
    street = STREET_MAP.get(len(req.community_cards), "flop")

    # Equity via Monte Carlo
    equity_decimal = calculate_equity(
        req.hole_cards,
        req.community_cards,
        num_players=req.num_players,
        iterations=settings.monte_carlo_iterations,
    )
    equity_pct = round(equity_decimal * 100, 2)

    # Pot odds
    if req.bet_to_call > 0:
        pot_odds_pct = calculate_pot_odds(req.bet_to_call, req.pot_size)
        pot_odds_ratio = calculate_pot_odds_ratio(req.bet_to_call, req.pot_size)
    else:
        pot_odds_pct = 0.0
        pot_odds_ratio = "inf:1"

    # equity_required as decimal for recommend function
    equity_required_decimal = pot_odds_pct / 100

    # EV
    ev = calculate_ev(equity_decimal, req.pot_size, req.bet_to_call)

    # Outs and rule of 2/4
    if street in ("flop", "turn"):
        outs_info = detect_outs(req.hole_cards, req.community_cards)
        total_outs = outs_info["total_outs"]
        rule_2_4 = rule_of_2_4(total_outs, street)
    else:
        outs_info = {"draws": [], "total_outs": 0, "outs_cards": []}
        total_outs = 0
        rule_2_4 = 0.0

    # SPR and effective stack
    spr = None
    effective_stack_info = None
    if req.your_stack is not None and req.villain_stack is not None:
        effective_stack_info = calculate_effective_stack(
            req.your_stack, req.villain_stack
        )
        if req.pot_size > 0:
            spr = round(
                calculate_spr(effective_stack_info["effective_stack"], req.pot_size), 2
            )

    # MDF
    if req.bet_to_call > 0:
        mdf_pct = round(calculate_mdf(req.bet_to_call, req.pot_size) * 100, 2)
    else:
        mdf_pct = None

    # Bet as percentage of pot
    if req.pot_size > 0 and req.bet_to_call > 0:
        bet_pot_percentage = round((req.bet_to_call / req.pot_size) * 100, 2)
    else:
        bet_pot_percentage = None

    # Preflop hand tier
    preflop_hand_tier = None
    if street == "preflop":
        preflop_hand_tier = get_preflop_hand_tier(req.hole_cards)

    # Recommendation
    rec_spr = spr if spr is not None else float("inf")
    action, reason, raise_info = recommend(
        equity=equity_decimal,
        equity_required=equity_required_decimal,
        ev_call=ev,
        spr=rec_spr,
        street=street,
        outs=total_outs,
        pot_size=req.pot_size,
        bet_to_call=req.bet_to_call,
        position=req.position,
        table_size=req.table_size,
        active_players=req.num_players,
    )

    rec = {"action": action, "reason": reason}
    if raise_info:
        rec["raise_sizing"] = raise_info

    return {
        "equity": equity_pct,
        "ev": ev,
        "pot_odds": pot_odds_pct,
        "pot_odds_ratio": pot_odds_ratio,
        "equity_required": pot_odds_pct,
        "outs": outs_info,
        "rule_of_2_4": rule_2_4,
        "hand_rank": None,
        "spr": spr,
        "mdf": mdf_pct,
        "bet_pot_percentage": bet_pot_percentage,
        "effective_stack": effective_stack_info,
        "preflop_hand_tier": preflop_hand_tier,
        "recommendation": rec,
        "street": street,
    }


@router.post("/api/parse-quick-entry")
def parse_quick_entry_endpoint(req: QuickEntryRequest):
    return parse_quick_entry(req.input)
