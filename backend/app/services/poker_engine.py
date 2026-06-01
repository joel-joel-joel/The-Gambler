"""Poker math engine — core calculation functions for The Gambler."""

import random
from typing import Optional

import eval7


# Preflop hand tiers (1 = premium, 10 = trash)
# Covers the full standard opening range (~170 hands)
HAND_TIERS = {
    1: ["AA", "KK"],
    2: ["QQ", "JJ", "AKs"],
    3: ["TT", "AQs", "AKo", "AJs"],
    4: ["99", "AQo", "ATs", "KQs"],
    5: ["88", "77", "KJs", "KTs", "QJs", "AJo", "ATo"],
    6: ["66", "55", "KQo", "KJo", "QTs", "JTs", "A9s", "A8s"],
    7: ["44", "33", "22", "T9s", "98s", "87s", "76s", "65s", "KTo", "QJo",
        "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "K9s", "Q9s", "J9s"],
    8: ["T8s", "97s", "86s", "75s", "54s", "A9o", "A8o", "K9o",
        "QTo", "JTo", "K8s", "Q8s", "J8s", "T7s", "96s", "85s", "64s", "53s"],
    9: ["A7o", "A6o", "A5o", "A4o", "A3o", "A2o", "K7s", "K6s", "K5s",
        "K8o", "Q9o", "J9o", "T9o", "98o", "87o", "76o", "65o",
        "K4s", "K3s", "K2s", "Q7s", "Q6s", "J7s", "T6s", "95s", "84s",
        "74s", "63s", "52s", "43s"],
    10: ["K7o", "K6o", "K5o", "K4o", "K3o", "K2o", "Q8o", "Q7o", "Q6o",
         "J8o", "J7o", "T8o", "T7o", "97o", "96o", "86o", "85o", "75o",
         "64o", "54o", "53o", "43o", "42s", "32s", "Q5s", "Q4s", "Q3s",
         "Q2s", "J6s", "J5s", "J4s", "J3s", "J2s", "T5s", "T4s", "T3s",
         "T2s", "94s", "93s", "92s", "83s", "82s", "73s", "72s", "62s"],
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

    Detects flush draws, straight draws (OESD, gutshot, double gutshot),
    overcards, pair-to-trips, and pocket-pair-to-set. Overcards are always
    counted even alongside flush/straight draws (standard poker education).

    Total outs = simple sum of each draw's outs, capped at 20.
    Each draw includes a human-readable description for drill explanations.

    Returns:
        Dict with "draws" (list of draw dicts), "total_outs", and "outs_cards".
    """
    if len(community_cards) >= 5:
        return {"draws": [], "total_outs": 0, "outs_cards": []}

    all_cards = hole_cards + community_cards
    draws: list[dict] = []
    outs_cards_set: set[str] = set()
    known_cards = set(all_cards)

    rank_values = {
        "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6,
        "9": 7, "T": 8, "J": 9, "Q": 10, "K": 11, "A": 12,
    }
    value_to_rank = {v: k for k, v in rank_values.items()}
    rank_names = {
        "2": "twos", "3": "threes", "4": "fours", "5": "fives",
        "6": "sixes", "7": "sevens", "8": "eights", "9": "nines",
        "T": "tens", "J": "jacks", "Q": "queens", "K": "kings", "A": "aces",
    }
    suit_names = {"s": "spade", "h": "heart", "d": "diamond", "c": "club"}
    all_suits = ["s", "h", "d", "c"]

    def _rank_val_to_out_cards(val: int) -> list[str]:
        actual_val = val if val >= 0 else 12
        rank_char = value_to_rank[actual_val]
        return [
            rank_char + s for s in all_suits
            if rank_char + s not in known_cards
        ]

    # --- Flush draw detection ---
    suit_counts: dict[str, list[str]] = {}
    for card in all_cards:
        suit_counts.setdefault(card[1], []).append(card)

    for suit, cards_in_suit in suit_counts.items():
        if len(cards_in_suit) == 4:
            flush_outs = [
                r + suit for r in rank_values
                if r + suit not in known_cards
            ]
            outs_count = len(flush_outs)
            draws.append({
                "draw_type": "flush_draw",
                "outs": outs_count,
                "description": f"{outs_count} {suit_names[suit]} outs for flush draw",
            })
            outs_cards_set.update(flush_outs)
            break

    # --- Straight draw detection ---
    rank_val_set = set(rank_values[card[0]] for card in all_cards)
    if 12 in rank_val_set:
        rank_val_set.add(-1)

    # Check for double gutshot first (two separate gutshots = 8 outs)
    gutshot_missing: list[int] = []
    for window_start in range(-1, 9):
        window = list(range(window_start, window_start + 5))
        present = [r for r in window if r in rank_val_set]
        missing = [r for r in window if r not in rank_val_set]
        if len(present) == 4 and len(missing) == 1:
            if missing[0] not in gutshot_missing:
                gutshot_missing.append(missing[0])

    found_oesd = False
    for start in range(-1, 10):
        run = list(range(start, start + 4))
        if all(r in rank_val_set for r in run):
            low_end = start - 1
            high_end = start + 4
            low_ok = low_end >= -1
            high_ok = high_end <= 12
            if low_ok and high_ok:
                found_oesd = True
                oesd_outs_cards: list[str] = []
                for end_val in [low_end, high_end]:
                    oesd_outs_cards.extend(_rank_val_to_out_cards(end_val))
                low_rank = value_to_rank[low_end if low_end >= 0 else 12]
                high_rank = value_to_rank[high_end]
                draws.append({
                    "draw_type": "open_ended_straight",
                    "outs": 8,
                    "description": f"8 outs for open-ended straight (need {low_rank} or {high_rank})",
                })
                outs_cards_set.update(oesd_outs_cards)
                break

    if not found_oesd:
        if len(gutshot_missing) >= 2:
            # Double gutshot — two different ranks each complete a straight
            dg_outs_cards: list[str] = []
            rank_strs = []
            for val in gutshot_missing[:2]:
                cards = _rank_val_to_out_cards(val)
                dg_outs_cards.extend(cards)
                actual_val = val if val >= 0 else 12
                rank_strs.append(value_to_rank[actual_val])
            outs_count = len(dg_outs_cards)
            draws.append({
                "draw_type": "double_gutshot",
                "outs": outs_count,
                "description": f"{outs_count} outs for double gutshot straight (need {rank_strs[0]} or {rank_strs[1]})",
            })
            outs_cards_set.update(dg_outs_cards)
        elif len(gutshot_missing) == 1:
            gs_cards = _rank_val_to_out_cards(gutshot_missing[0])
            outs_count = len(gs_cards)
            actual_val = gutshot_missing[0] if gutshot_missing[0] >= 0 else 12
            needed_rank = value_to_rank[actual_val]
            draws.append({
                "draw_type": "gutshot_straight",
                "outs": outs_count,
                "description": f"{outs_count} {rank_names[needed_rank]} for gutshot straight",
            })
            outs_cards_set.update(gs_cards)

    # --- Overcard detection (always counted, even with flush/straight draws) ---
    if community_cards:
        board_max_rank = max(rank_values[card[0]] for card in community_cards)
        hole_overcards = [
            card for card in hole_cards
            if rank_values[card[0]] > board_max_rank
        ]
        # Exclude ranks that pair the board (trips_draw handles those)
        board_ranks_set = set(card[0] for card in community_cards)
        hole_overcards = [
            card for card in hole_overcards
            if card[0] not in board_ranks_set
        ]
        # Exclude pocket pairs (set_draw handles those)
        hole_rank_set = [card[0] for card in hole_cards]
        if hole_rank_set[0] == hole_rank_set[1]:
            hole_overcards = []
        if hole_overcards:
            overcard_outs: list[str] = []
            for hc in hole_overcards:
                for s in all_suits:
                    candidate = hc[0] + s
                    if candidate not in known_cards:
                        overcard_outs.append(candidate)
            outs_count = len(overcard_outs)
            if outs_count > 0:
                names = [rank_names[hc[0]] for hc in hole_overcards]
                draws.append({
                    "draw_type": "overcards",
                    "outs": outs_count,
                    "description": f"{outs_count} {'/'.join(names)} for top pair",
                })
                outs_cards_set.update(overcard_outs)

    # --- Pair improvement: pocket pair → set ---
    hole_ranks = [card[0] for card in hole_cards]
    board_ranks = [card[0] for card in community_cards]

    if hole_ranks[0] == hole_ranks[1] and hole_ranks[0] not in board_ranks:
        pair_rank = hole_ranks[0]
        pair_outs = [
            pair_rank + s for s in all_suits
            if pair_rank + s not in known_cards
        ]
        if pair_outs:
            draws.append({
                "draw_type": "set_draw",
                "outs": len(pair_outs),
                "description": f"{len(pair_outs)} {rank_names[pair_rank]} for a set",
            })
            outs_cards_set.update(pair_outs)

    # --- Pair improvement: hole card pairs board → trips ---
    elif hole_ranks[0] != hole_ranks[1]:
        for hc in hole_cards:
            if hc[0] in board_ranks:
                trip_outs = [
                    hc[0] + s for s in all_suits
                    if hc[0] + s not in known_cards
                ]
                if trip_outs:
                    draws.append({
                        "draw_type": "trips_draw",
                        "outs": len(trip_outs),
                        "description": f"{len(trip_outs)} {rank_names[hc[0]]} for trips",
                    })
                    outs_cards_set.update(trip_outs)

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
