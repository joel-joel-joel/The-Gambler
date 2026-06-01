from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.models.database import RoundRecord, RoundCondensed

logger = logging.getLogger(__name__)

MAX_FULL_ROUNDS = 5


def condense_round_rule_based(round_data: dict) -> dict:
    """Generate a condensed version of a round using rules (no AI)."""
    hole_cards = round_data.get("hole_cards", [])
    result = round_data.get("result", "unknown")
    profit = round_data.get("profit", 0.0)
    pot_size = round_data.get("pot_size", 0.0)
    position = round_data.get("position", "unknown")
    community_cards = round_data.get("community_cards", [])

    hand_str = " ".join(hole_cards) if hole_cards else "unknown hand"
    board_str = " ".join(community_cards) if community_cards else "no board"

    if result == "won":
        key_decision = f"Won ${profit:.0f} pot with {hand_str} from {position}"
        lesson = f"Profitable play on {board_str}"
    elif result == "lost":
        key_decision = f"Lost ${abs(profit):.0f} with {hand_str} from {position}"
        lesson = f"Review sizing decisions on {board_str}"
    elif result == "folded":
        key_decision = f"Folded {hand_str} from {position}, pot was ${pot_size:.0f}"
        lesson = "Fold decision — check if pot odds warranted a call"
    else:
        key_decision = f"Played {hand_str} from {position}"
        lesson = "Round completed"

    return {
        "hole_cards": hole_cards,
        "result": result,
        "profit": profit,
        "key_decision": key_decision,
        "lesson": lesson,
    }


async def condense_round_ai(round_data: dict) -> dict:
    """Generate a condensed version using AI, falling back to rule-based."""
    try:
        from app.services.ai_service import chat_with_ai

        prompt = (
            "Condense this poker round into a one-line key_decision and a one-line lesson. "
            "Be specific with numbers. Return ONLY a JSON object: "
            '{"key_decision": "...", "lesson": "..."}\n\n'
            f"Round data: {json.dumps(round_data)}"
        )
        raw = await chat_with_ai(
            "You are a poker analysis assistant. Return only valid JSON.",
            prompt,
        )
        parsed = json.loads(raw.strip().strip("`").strip())
        return {
            "hole_cards": round_data.get("hole_cards", []),
            "result": round_data.get("result"),
            "profit": round_data.get("profit", 0.0),
            "key_decision": parsed.get("key_decision", ""),
            "lesson": parsed.get("lesson", ""),
        }
    except Exception as e:
        logger.warning(f"AI condensation failed, using rule-based: {e}")
        return condense_round_rule_based(round_data)


def maybe_condense_oldest(db: Session, session_id: int) -> int:
    """If there are more than MAX_FULL_ROUNDS, condense the oldest ones."""
    full_rounds = (
        db.query(RoundRecord)
        .filter(RoundRecord.session_id == session_id)
        .order_by(RoundRecord.round_number)
        .all()
    )

    condensed_count = 0
    while len(full_rounds) > MAX_FULL_ROUNDS:
        oldest = full_rounds.pop(0)
        round_data = {
            "hole_cards": json.loads(oldest.hole_cards),
            "community_cards": json.loads(oldest.community_cards),
            "result": oldest.result,
            "profit": oldest.profit,
            "pot_size": oldest.pot_size,
            "position": oldest.position,
        }

        condensed = condense_round_rule_based(round_data)

        condensed_rec = RoundCondensed(
            session_id=session_id,
            round_number=oldest.round_number,
            hole_cards=oldest.hole_cards,
            result=condensed["result"],
            profit=condensed["profit"],
            key_decision=condensed["key_decision"],
            lesson=condensed["lesson"],
        )
        db.add(condensed_rec)
        db.delete(oldest)
        condensed_count += 1

    if condensed_count > 0:
        db.commit()

    return condensed_count
