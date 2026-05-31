"""Poker math engine — core calculation functions for The Gambler."""

import random
from typing import Optional

import eval7


# Preflop hand tiers (1 = premium, 8 = speculative)
HAND_TIERS = {
    1: ["AA", "KK"],
    2: ["QQ", "JJ", "AKs"],
    3: ["TT", "AQs", "AKo", "AJs"],
    4: ["99", "AQo", "ATs", "KQs"],
    5: ["88", "77", "KJs", "KTs", "QJs", "AJo", "ATo"],
    6: ["66", "55", "KQo", "KJo", "QTs", "JTs"],
    7: ["44", "33", "22", "T9s", "98s", "87s", "76s", "65s", "KTo", "QJo"],
    8: ["J9s", "T8s", "97s", "86s", "75s", "54s", "Q9s"],
}

# Rank ordering for normalization (high to low)
RANK_ORDER = "AKQJT98765432"


def calculate_pot_odds(bet_to_call: float, pot_size: float) -> float:
    """Calculate pot odds as a percentage.

    Returns the percentage of the new pot that the call represents.
    E.g., calling 20 into a 100 pot = 20/120 = 16.67%
    """
    total_pot = pot_size + bet_to_call
    return round((bet_to_call / total_pot) * 100, 2)


def calculate_pot_odds_ratio(bet_to_call: float, pot_size: float) -> str:
    """Calculate pot odds as a ratio string (e.g., '6:1').

    The ratio is (pot_size + bet_to_call) : bet_to_call, representing
    the total pot you stand to win versus what you must risk.
    """
    if bet_to_call == 0:
        return "inf:1"
    total_pot = pot_size + bet_to_call
    ratio = total_pot / bet_to_call
    # Round to nearest integer for clean display
    ratio_int = round(ratio)
    return f"{ratio_int}:1"


def calculate_ev(equity: float, pot_size: float, bet_to_call: float) -> float:
    """Calculate expected value of a call.

    EV = (equity × pot_after_call) - ((1 - equity) × bet_to_call)
    """
    pot_after_call = pot_size + bet_to_call
    ev = (equity * pot_after_call) - ((1 - equity) * bet_to_call)
    return round(ev, 2)


def calculate_spr(effective_stack: float, pot_size: float) -> float:
    """Calculate Stack-to-Pot Ratio.

    Returns infinity if pot is 0.
    """
    if pot_size == 0:
        return float("inf")
    return effective_stack / pot_size


def calculate_mdf(bet_size: float, pot_size: float) -> float:
    """Calculate Minimum Defense Frequency.

    MDF = pot_size / (pot_size + bet_size)
    Returns a decimal (0.5 = 50%).
    """
    return pot_size / (pot_size + bet_size)


def calculate_bluff_break_even(bluff_size: float, pot_size: float) -> float:
    """Calculate break-even frequency for a bluff.

    Returns the minimum fold frequency needed for a bluff to be profitable.
    break_even = bluff_size / (pot_size + bluff_size)
    """
    return bluff_size / (pot_size + bluff_size)


def calculate_fold_equity(fold_probability: float, pot_size: float) -> float:
    """Calculate fold equity in chip value.

    fold_equity = fold_probability × pot_size
    """
    return fold_probability * pot_size


def calculate_effective_stack(
    your_stack: float, villain_stack: float, bb: float = 1
) -> dict:
    """Calculate effective stack and classify stack depth.

    Returns dict with:
      - effective_stack: min of both stacks
      - effective_stack_bb: effective stack in big blinds
      - stack_depth: "short" (<25bb), "medium" (25-80bb), "deep" (>80bb)
    """
    effective = min(your_stack, villain_stack)
    effective_bb = effective / bb

    if effective_bb < 25:
        depth = "short"
    elif effective_bb <= 80:
        depth = "medium"
    else:
        depth = "deep"

    return {
        "effective_stack": effective,
        "effective_stack_bb": effective_bb,
        "stack_depth": depth,
    }


def rule_of_2_4(outs: int, street: str) -> float:
    """Estimate equity using the rule of 2 and 4.

    On the flop (two cards to come): outs × 4
    On the turn (one card to come): outs × 2
    Capped at 100%.
    """
    if street == "flop":
        result = outs * 4.0
    else:
        result = outs * 2.0
    return min(result, 100.0)


def calculate_equity(
    hole_cards: list[str],
    community_cards: list[str],
    num_players: int = 2,
    iterations: int = 10000,
) -> float:
    """Calculate hand equity using Monte Carlo simulation with eval7.

    Args:
        hole_cards: List of 2 card strings, e.g. ["Ah", "Kd"]
        community_cards: List of 0-5 community card strings
        num_players: Number of players (including hero)
        iterations: Number of Monte Carlo iterations

    Returns:
        Float between 0.0 and 1.0 representing win probability.
    """
    # Parse hero's hole cards
    hero_cards = [eval7.Card(c) for c in hole_cards]

    # Parse community cards
    board = [eval7.Card(c) for c in community_cards]

    # Build the remaining deck (exclude known cards)
    all_cards = eval7.Deck().cards
    known_cards = set(hero_cards + board)
    remaining = [c for c in all_cards if c not in known_cards]

    wins = 0
    ties = 0

    num_opponents = num_players - 1
    cards_needed_for_board = 5 - len(board)

    for _ in range(iterations):
        random.shuffle(remaining)

        # Deal: first fill the board, then deal opponent hands
        idx = 0
        sim_board = board + remaining[idx : idx + cards_needed_for_board]
        idx += cards_needed_for_board

        # Deal opponent hole cards
        opponent_hands = []
        for _ in range(num_opponents):
            opponent_hands.append(remaining[idx : idx + 2])
            idx += 2

        # Evaluate hero's hand (lower score = better hand in eval7)
        hero_score = eval7.evaluate(hero_cards + sim_board)

        # Evaluate each opponent
        best_opponent_score = -1
        for opp_hand in opponent_hands:
            opp_score = eval7.evaluate(opp_hand + sim_board)
            if opp_score > best_opponent_score:
                best_opponent_score = opp_score

        # In eval7, HIGHER score = BETTER hand
        if hero_score > best_opponent_score:
            wins += 1
        elif hero_score == best_opponent_score:
            ties += 1

    return (wins + ties / 2) / iterations


def detect_outs(hole_cards: list[str], community_cards: list[str]) -> dict:
    """Detect drawing outs from hole cards and community cards.

    Detects flush draws, open-ended straight draws, gutshot straight draws,
    and overcards. Combines outs for combo draws (capped at 20).

    Args:
        hole_cards: List of 2 card strings, e.g. ["Ah", "Kd"]
        community_cards: List of 3-5 community card strings

    Returns:
        Dict with "draws" (list of draw dicts), "total_outs", and "outs_cards".
    """
    # If river (5 community cards), no draws matter
    if len(community_cards) >= 5:
        return {"draws": [], "total_outs": 0, "outs_cards": []}

    all_cards = hole_cards + community_cards
    draws: list[dict] = []
    outs_cards_set: set[str] = set()

    # Build set of all known cards for exclusion
    known_cards = set(all_cards)

    # --- Rank and suit helpers ---
    rank_values = {
        "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6,
        "9": 7, "T": 8, "J": 9, "Q": 10, "K": 11, "A": 12,
    }
    value_to_rank = {v: k for k, v in rank_values.items()}
    all_suits = ["s", "h", "d", "c"]

    has_flush_draw = False
    has_straight_draw = False

    # --- Flush draw detection ---
    suit_counts: dict[str, list[str]] = {}
    for card in all_cards:
        suit = card[1]
        suit_counts.setdefault(suit, []).append(card)

    for suit, cards_in_suit in suit_counts.items():
        if len(cards_in_suit) == 4:
            # 9 outs for flush draw
            flush_outs = []
            for rank_char in rank_values:
                candidate = rank_char + suit
                if candidate not in known_cards:
                    flush_outs.append(candidate)
            draws.append({"draw_type": "flush_draw", "outs": 9})
            outs_cards_set.update(flush_outs)
            has_flush_draw = True
            break  # Only one flush draw possible

    # --- Straight draw detection ---
    # Get unique rank values present in all cards
    rank_val_set = set(rank_values[card[0]] for card in all_cards)
    # Add ace-low representation (-1) if ace is present
    if 12 in rank_val_set:
        rank_val_set.add(-1)

    def _rank_val_to_out_cards(val: int) -> list[str]:
        """Convert a rank value to the list of unknown cards of that rank."""
        actual_val = val if val >= 0 else 12  # -1 (ace-low) maps to Ace
        rank_char = value_to_rank[actual_val]
        return [
            rank_char + s for s in all_suits
            if rank_char + s not in known_cards
        ]

    # OESD: 4 consecutive ranks where BOTH ends can complete a 5-card straight.
    # We look for runs of 4 consecutive in rank_val_set and check if adding
    # a card on either end produces a valid straight window.
    # Valid straight windows span 5 consecutive values within [-1..3] to [8..12].
    found_oesd = False
    oesd_outs_cards: list[str] = []

    for start in range(-1, 10):
        run = list(range(start, start + 4))
        if all(r in rank_val_set for r in run):
            low_end = start - 1
            high_end = start + 4
            # Low-end straight: (start-1) through (start+3), valid if start-1 >= -1
            low_ok = low_end >= -1
            # High-end straight: start through (start+4), valid if start+4 <= 12
            high_ok = high_end <= 12
            if low_ok and high_ok:
                found_oesd = True
                for end_val in [low_end, high_end]:
                    oesd_outs_cards.extend(_rank_val_to_out_cards(end_val))
                break  # Found the best OESD

    # Gutshot: in any 5-card straight window, we have exactly 4 of 5 ranks.
    # Only look for gutshot if no OESD was found (de-duplicate straight draw types).
    found_gutshot = False
    gutshot_outs_cards: list[str] = []

    if not found_oesd:
        for window_start in range(-1, 9):
            window = list(range(window_start, window_start + 5))
            present = [r for r in window if r in rank_val_set]
            missing = [r for r in window if r not in rank_val_set]
            if len(present) == 4 and len(missing) == 1:
                found_gutshot = True
                gutshot_outs_cards = _rank_val_to_out_cards(missing[0])
                break

    if found_oesd:
        draws.append({"draw_type": "open_ended_straight", "outs": 8})
        outs_cards_set.update(oesd_outs_cards)
        has_straight_draw = True
    elif found_gutshot:
        draws.append({"draw_type": "gutshot_straight", "outs": 4})
        outs_cards_set.update(gutshot_outs_cards)
        has_straight_draw = True

    # --- Overcard detection ---
    # Only count overcards when there is no flush draw or straight draw,
    # since pairing overcards is a much weaker draw and would inflate outs.
    if community_cards and not has_flush_draw and not has_straight_draw:
        board_max_rank = max(rank_values[card[0]] for card in community_cards)
        hole_overcards = [
            card for card in hole_cards if rank_values[card[0]] > board_max_rank
        ]

        if len(hole_overcards) >= 1:
            outs_count = 3 * len(hole_overcards)
            overcard_outs: list[str] = []
            for hc in hole_overcards:
                rank_char = hc[0]
                for s in all_suits:
                    candidate = rank_char + s
                    if candidate not in known_cards:
                        overcard_outs.append(candidate)
            draws.append({"draw_type": "overcards", "outs": outs_count})
            outs_cards_set.update(overcard_outs)

    # --- Calculate total outs (sum of draw outs, capped at 20) ---
    total_outs = min(sum(d["outs"] for d in draws), 20)

    return {
        "draws": draws,
        "total_outs": total_outs,
        "outs_cards": sorted(outs_cards_set),
    }


def get_preflop_hand_tier(hole_cards: list[str]) -> Optional[int]:
    """Look up a preflop hand in the tier table.

    Args:
        hole_cards: List of 2 card strings, e.g. ["Ah", "Kd"]

    Returns:
        Tier number (1-8) or None if not in any tier.
    """
    # Extract ranks and suits
    rank1, suit1 = hole_cards[0][0], hole_cards[0][1]
    rank2, suit2 = hole_cards[1][0], hole_cards[1][1]

    # Normalize: higher rank first
    idx1 = RANK_ORDER.index(rank1)
    idx2 = RANK_ORDER.index(rank2)

    if idx1 > idx2:
        # rank2 is higher, swap
        rank1, rank2 = rank2, rank1
        suit1, suit2 = suit2, suit1

    # Build hand notation
    if rank1 == rank2:
        hand_str = f"{rank1}{rank2}"
    elif suit1 == suit2:
        hand_str = f"{rank1}{rank2}s"
    else:
        hand_str = f"{rank1}{rank2}o"

    # Look up in tiers
    for tier, hands in HAND_TIERS.items():
        if hand_str in hands:
            return tier

    return None
