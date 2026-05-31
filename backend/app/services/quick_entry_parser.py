"""Quick entry parser — converts shorthand notation into structured game state.

Supports formats like:
    "AKs 150 40 btn 6p"  -> suited hand, pot 150, bet 40, button, 6 players
    "AhKd 200 75 co"     -> specific suits, pot 200, bet 75, cutoff
    "99 80 20"            -> pocket pair, pot 80, bet 20
"""

import re
from typing import Optional

# Valid ranks and suits for card parsing
VALID_RANKS = set("AKQJT98765432")
VALID_SUITS = {"h", "d", "c", "s"}

# Valid positions (case-insensitive input, always uppercase output)
VALID_POSITIONS = {"BTN", "CO", "MP", "UTG", "SB", "BB"}

# Default suits used when only suited/offsuit/pair notation is given
_DEFAULT_SUIT_1 = "s"  # spades
_DEFAULT_SUIT_2_SUITED = "s"  # same suit for suited hands
_DEFAULT_SUIT_2_OFFSUIT = "h"  # different suit for offsuit/pairs
_DEFAULT_PAIR_SUITS = ("s", "h")  # two different suits for pocket pairs


def _empty_result() -> dict:
    """Return the default empty result structure."""
    return {
        "hole_cards": None,
        "pot_size": None,
        "bet_to_call": None,
        "position": None,
        "num_players": None,
        "confidence": 0.0,
        "assumptions": [],
    }


def _parse_hand_token(token: str) -> Optional[dict]:
    """Parse the first token as a hand.

    Returns a dict with hole_cards, confidence, assumptions, or None if invalid.
    """
    if not token:
        return None

    # Case 1: Specific suits — e.g. "AhKd", "QhJd", "9s9h"
    # Pattern: Rank + suit + Rank + suit (4 chars for normal, could be 4 for T+)
    specific_match = re.match(
        r"^([AKQJT2-9])([hdcs])([AKQJT2-9])([hdcs])$", token, re.IGNORECASE
    )
    if specific_match:
        r1, s1, r2, s2 = specific_match.groups()
        card1 = r1.upper() + s1.lower()
        card2 = r2.upper() + s2.lower()
        return {
            "hole_cards": [card1, card2],
            "confidence": 0.95,
            "assumptions": [],
        }

    # Case 2: Pocket pair — e.g. "99", "AA", "TT"
    pair_match = re.match(r"^([AKQJT2-9])\1$", token, re.IGNORECASE)
    if pair_match:
        rank = pair_match.group(1).upper()
        s1, s2 = _DEFAULT_PAIR_SUITS
        card1 = rank + s1
        card2 = rank + s2
        return {
            "hole_cards": [card1, card2],
            "confidence": 0.85,
            "assumptions": [f"Assigned default suits: {card1} {card2}"],
        }

    # Case 3: Suited hand — e.g. "AKs", "QTs"
    suited_match = re.match(
        r"^([AKQJT2-9])([AKQJT2-9])([sS])$", token, re.IGNORECASE
    )
    if suited_match:
        r1, r2, _ = suited_match.groups()
        r1 = r1.upper()
        r2 = r2.upper()
        suit = _DEFAULT_SUIT_1
        card1 = r1 + suit
        card2 = r2 + suit
        return {
            "hole_cards": [card1, card2],
            "confidence": 0.85,
            "assumptions": [f"Assigned default suits: {card1} {card2}"],
        }

    # Case 4: Offsuit hand — e.g. "AKo", "QTo"
    offsuit_match = re.match(
        r"^([AKQJT2-9])([AKQJT2-9])([oO])$", token, re.IGNORECASE
    )
    if offsuit_match:
        r1, r2, _ = offsuit_match.groups()
        r1 = r1.upper()
        r2 = r2.upper()
        card1 = r1 + _DEFAULT_SUIT_1
        card2 = r2 + _DEFAULT_SUIT_2_OFFSUIT
        return {
            "hole_cards": [card1, card2],
            "confidence": 0.85,
            "assumptions": [f"Assigned default suits: {card1} {card2}"],
        }

    return None


def parse_quick_entry(input_str: str) -> dict:
    """Parse a quick entry string into structured game state.

    Args:
        input_str: Shorthand like "AKs 150 40 btn 6p"

    Returns:
        Dict with hole_cards, pot_size, bet_to_call, position,
        num_players, confidence, and assumptions.
    """
    result = _empty_result()

    stripped = input_str.strip()
    if not stripped:
        return result

    tokens = stripped.split()
    if not tokens:
        return result

    # First token is always the hand
    hand_info = _parse_hand_token(tokens[0])
    if hand_info is None:
        # Could not parse hand — return with low confidence
        result["confidence"] = 0.1
        result["assumptions"].append(f"Could not parse hand: {tokens[0]}")
        return result

    result["hole_cards"] = hand_info["hole_cards"]
    result["confidence"] = hand_info["confidence"]
    result["assumptions"] = hand_info["assumptions"]

    # Parse remaining tokens (order-independent)
    numbers_found = []

    for token in tokens[1:]:
        upper_token = token.upper()

        # Check for position
        if upper_token in VALID_POSITIONS:
            result["position"] = upper_token
            continue

        # Check for player count — e.g. "6p", "6players", "9p"
        player_match = re.match(r"^(\d+)(p|players?)$", token, re.IGNORECASE)
        if player_match:
            result["num_players"] = int(player_match.group(1))
            continue

        # Check for number (pot or bet)
        number_match = re.match(r"^(\d+(?:\.\d+)?)$", token)
        if number_match:
            numbers_found.append(float(token) if "." in token else int(token))
            continue

        # Unknown token — note as assumption
        result["assumptions"].append(f"Ignored unknown token: {token}")

    # Assign numbers: first = pot, second = bet
    if len(numbers_found) >= 1:
        result["pot_size"] = numbers_found[0]
    if len(numbers_found) >= 2:
        result["bet_to_call"] = numbers_found[1]
    if len(numbers_found) > 2:
        result["assumptions"].append(
            f"Extra numbers ignored: {numbers_found[2:]}"
        )

    return result
