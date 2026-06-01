from __future__ import annotations

from pydantic import BaseModel, Field


SKILL_DEFINITIONS = {
    "outs": {
        "graduation_accuracy": 0.90,
        "required_attempts": 50,
        "tolerance": 0,
        "answer_type": "integer",
        "timer_seconds": 15,
        "order": 1,
    },
    "rule_of_2_4": {
        "graduation_accuracy": 0.85,
        "required_attempts": 50,
        "tolerance": 5.0,
        "answer_type": "percentage",
        "timer_seconds": 15,
        "order": 2,
    },
    "pot_odds": {
        "graduation_accuracy": 0.85,
        "required_attempts": 50,
        "tolerance": 2.0,
        "answer_type": "percentage",
        "timer_seconds": 15,
        "order": 3,
    },
    "the_decision": {
        "graduation_accuracy": 0.80,
        "required_attempts": 30,
        "tolerance": 0,
        "answer_type": "decision",
        "timer_seconds": 15,
        "order": 4,
    },
    "spr_commitment": {
        "graduation_accuracy": 0.80,
        "required_attempts": 30,
        "tolerance": 0.5,
        "answer_type": "decimal",
        "timer_seconds": 15,
        "order": 5,
    },
    "bluff_math": {
        "graduation_accuracy": 0.80,
        "required_attempts": 30,
        "tolerance": 3.0,
        "answer_type": "percentage",
        "timer_seconds": 15,
        "order": 6,
    },
}

SKILL_ORDER = ["outs", "rule_of_2_4", "pot_odds", "the_decision", "spr_commitment", "bluff_math"]


class GenerateDrillRequest(BaseModel):
    skill: str = Field(..., description="One of: outs, rule_of_2_4, pot_odds, the_decision, spr_commitment, bluff_math")
    source: str = Field("random", description="'random' or 'history'")


class CheckDrillRequest(BaseModel):
    drill_id: str = Field(..., description="UUID of the pending drill")
    user_answer: float = Field(..., description="User's answer")
    response_time_ms: int = Field(..., description="Time taken in milliseconds")


class ReviewCheckRequest(BaseModel):
    hand_index: int
    question_index: int
    user_answer: float


class GenerateDrillResponse(BaseModel):
    drill_id: str
    scenario: dict
    question_text: str
    answer_type: str


class CheckDrillResponse(BaseModel):
    is_correct: bool
    correct_answer: float
    explanation: str | None = None
    accuracy_now: float
    graduated: bool


class SkillProgressResponse(BaseModel):
    skill: str
    total_attempts: int
    correct_count: int
    current_accuracy: float
    status: str
    streak_days: int
    last_attempt_date: str | None = None
    best_streak: int
    avg_response_time_ms: int
    graduated_at: str | None = None


class DrillAttemptResponse(BaseModel):
    id: int
    skill: str
    is_correct: bool
    correct_answer: float
    user_answer: float
    response_time_ms: int
    source: str
    created_at: str | None = None


class FocusSuggestionResponse(BaseModel):
    suggested_skill: str
    reason: str


class ReviewQuestion(BaseModel):
    question_text: str
    correct_answer: float
    answer_type: str
    tolerance: float


class ReviewHand(BaseModel):
    round_number: int
    hole_cards: list[str]
    community_cards: list[str]
    pot_size: float
    bet_to_call: float
    result: str | None
    ev_gap: float
    questions: list[ReviewQuestion]


class SessionReviewResponse(BaseModel):
    hands: list[ReviewHand]


class ReviewCheckResponse(BaseModel):
    is_correct: bool
    correct_answer: float
    explanation: str | None = None
