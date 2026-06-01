import { useState, useEffect } from "react";
import { useTraining } from "../hooks/useTraining";
import { formatCard } from "../utils/cardUtils";
import type {
  SessionData,
  SessionReview,
  ReviewCheckResult,
  ReviewHand,
} from "../types";

type ReviewState =
  | { mode: "list" }
  | { mode: "loading" }
  | {
      mode: "active";
      sessionId: number;
      review: SessionReview;
      handIdx: number;
      questionIdx: number;
      answers: boolean[][];
    }
  | {
      mode: "feedback";
      sessionId: number;
      review: SessionReview;
      handIdx: number;
      questionIdx: number;
      answers: boolean[][];
      lastResult: ReviewCheckResult;
    }
  | { mode: "summary"; review: SessionReview; answers: boolean[][] };

function ReviewCardDisplay({
  code,
  variant,
}: {
  code: string;
  variant: "hole" | "community";
}) {
  const { rank, symbol, color } = formatCard(code);
  const bg = variant === "hole" ? "bg-gold-700" : "bg-emerald-900";
  return (
    <span
      className={`inline-flex items-center justify-center ${bg} rounded px-1.5 py-0.5 text-sm font-mono font-bold ${color}`}
    >
      {rank}
      {symbol}
    </span>
  );
}

function HandScenario({ hand }: { hand: ReviewHand }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-400">Hand #{hand.round_number}</span>
        {hand.result && (
          <span
            className={`text-xs rounded px-1.5 py-0.5 ${
              hand.result === "win"
                ? "bg-emerald-900 text-emerald-200"
                : hand.result === "loss"
                  ? "bg-red-900 text-red-200"
                  : "bg-surface-raised text-stone-400"
            }`}
          >
            {hand.result}
          </span>
        )}
      </div>

      {hand.hole_cards.length > 0 && (
        <div>
          <span className="text-xs text-stone-400 mr-2">Hole Cards</span>
          <div className="inline-flex gap-1">
            {hand.hole_cards.map((c) => (
              <ReviewCardDisplay key={c} code={c} variant="hole" />
            ))}
          </div>
        </div>
      )}

      {hand.community_cards.length > 0 && (
        <div>
          <span className="text-xs text-stone-400 mr-2">Board</span>
          <div className="inline-flex gap-1">
            {hand.community_cards.map((c) => (
              <ReviewCardDisplay key={c} code={c} variant="community" />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-stone-400">
        <span>
          Pot: <span className="font-mono text-stone-200">${hand.pot_size}</span>
        </span>
        <span>
          Bet to call:{" "}
          <span className="font-mono text-stone-200">${hand.bet_to_call}</span>
        </span>
        <span>
          EV Gap:{" "}
          <span className="font-mono text-stone-200">
            {hand.ev_gap >= 0 ? "+" : ""}
            {hand.ev_gap.toFixed(2)}
          </span>
        </span>
      </div>
    </div>
  );
}

function formatSessionDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown date";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SummaryView({
  review,
  answers,
  onDone,
}: {
  review: SessionReview;
  answers: boolean[][];
  onDone: () => void;
}) {
  const totalQuestions = answers.reduce((sum, hand) => sum + hand.length, 0);
  const totalCorrect = answers.reduce(
    (sum, hand) => sum + hand.filter(Boolean).length,
    0,
  );

  return (
    <div className="space-y-4">
      <h4 className="text-stone-200 font-semibold">Review Summary</h4>

      <div className="bg-surface-deep rounded-lg p-3 border border-surface-raised">
        <p className="text-stone-300 text-sm">
          Score:{" "}
          <span className="font-mono text-stone-200 font-semibold">
            {totalCorrect} / {totalQuestions}
          </span>{" "}
          <span className="text-stone-400">
            ({totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(0) : 0}
            %)
          </span>
        </p>
      </div>

      <div className="space-y-3">
        {review.hands.map((hand, hIdx) => (
          <div
            key={hIdx}
            className="bg-surface-deep rounded-lg p-3 border border-surface-raised"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-stone-300">
                Hand #{hand.round_number}
              </span>
              {hand.hole_cards.length > 0 && (
                <div className="inline-flex gap-1">
                  {hand.hole_cards.map((c) => (
                    <ReviewCardDisplay key={c} code={c} variant="hole" />
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {hand.questions.map((_q, qIdx) => {
                const isCorrect = answers[hIdx]?.[qIdx];
                return (
                  <span
                    key={qIdx}
                    className={`text-xs font-mono rounded px-2 py-1 ${
                      isCorrect
                        ? "bg-emerald-900 text-emerald-400"
                        : "bg-red-900 text-red-400"
                    }`}
                  >
                    Q{qIdx + 1}: {isCorrect ? "Correct" : "Incorrect"}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onDone}
        className="px-4 py-2 bg-gold text-stone-900 font-semibold rounded hover:bg-gold-400 cursor-pointer transition-colors duration-200"
      >
        Done
      </button>
    </div>
  );
}

export function SessionReviewSection() {
  const { generateReview, checkReviewAnswer } = useTraining();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>({ mode: "list" });
  const [userAnswer, setUserAnswer] = useState("");
  const [decisionAnswer, setDecisionAnswer] = useState<"call" | "fold" | null>(
    null,
  );
  const [checkingAnswer, setCheckingAnswer] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSessions() {
      setSessionsLoading(true);
      setSessionsError(null);
      try {
        const resp = await fetch("/api/sessions");
        if (!resp.ok) throw new Error("Failed to fetch sessions");
        const data: SessionData[] = await resp.json();
        if (!cancelled) {
          setSessions(data);
        }
      } catch (err) {
        if (!cancelled) {
          setSessionsError(
            err instanceof Error ? err.message : "Failed to load sessions",
          );
        }
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    }
    loadSessions();
    return () => {
      cancelled = true;
    };
  }, []);

  const completedSessions = sessions.filter(
    (s) => !s.is_active && s.total_rounds > 0,
  );

  const handleStartReview = async (sessionId: number) => {
    setReviewState({ mode: "loading" });
    setCheckError(null);
    try {
      const review = await generateReview(sessionId);
      if (review.hands.length === 0) {
        setReviewState({ mode: "list" });
        setCheckError("No reviewable hands found for this session.");
        return;
      }
      const emptyAnswers = review.hands.map(() => [] as boolean[]);
      setReviewState({
        mode: "active",
        sessionId,
        review,
        handIdx: 0,
        questionIdx: 0,
        answers: emptyAnswers,
      });
      setUserAnswer("");
      setDecisionAnswer(null);
    } catch (err) {
      setReviewState({ mode: "list" });
      setCheckError(
        err instanceof Error ? err.message : "Failed to generate review",
      );
    }
  };

  const handleSubmitAnswer = async () => {
    if (reviewState.mode !== "active") return;
    const { sessionId, review, handIdx, questionIdx, answers } = reviewState;
    const question = review.hands[handIdx].questions[questionIdx];

    let numericAnswer: number;
    if (question.answer_type === "decision") {
      if (!decisionAnswer) return;
      numericAnswer = decisionAnswer === "call" ? 1 : 0;
    } else {
      const parsed = parseFloat(userAnswer);
      if (isNaN(parsed)) return;
      numericAnswer = parsed;
    }

    setCheckingAnswer(true);
    setCheckError(null);
    try {
      const result = await checkReviewAnswer(
        sessionId,
        handIdx,
        questionIdx,
        question.correct_answer,
        numericAnswer,
        question.answer_type,
        question.tolerance,
      );

      const newAnswers = answers.map((handAnswers, hIdx) =>
        hIdx === handIdx
          ? [...handAnswers, result.is_correct]
          : [...handAnswers],
      );

      setReviewState({
        mode: "feedback",
        sessionId,
        review,
        handIdx,
        questionIdx,
        answers: newAnswers,
        lastResult: result,
      });
    } catch (err) {
      setCheckError(
        err instanceof Error ? err.message : "Failed to check answer",
      );
    } finally {
      setCheckingAnswer(false);
    }
  };

  const handleNextQuestion = () => {
    if (reviewState.mode !== "feedback") return;
    const { sessionId, review, handIdx, questionIdx, answers } = reviewState;
    const currentHand = review.hands[handIdx];
    const nextQuestionIdx = questionIdx + 1;

    setUserAnswer("");
    setDecisionAnswer(null);
    setCheckError(null);

    if (nextQuestionIdx < currentHand.questions.length) {
      setReviewState({
        mode: "active",
        sessionId,
        review,
        handIdx,
        questionIdx: nextQuestionIdx,
        answers,
      });
    } else {
      const nextHandIdx = handIdx + 1;
      if (nextHandIdx < review.hands.length) {
        setReviewState({
          mode: "active",
          sessionId,
          review,
          handIdx: nextHandIdx,
          questionIdx: 0,
          answers,
        });
      } else {
        setReviewState({ mode: "summary", review, answers });
      }
    }
  };

  const handleDone = () => {
    setReviewState({ mode: "list" });
    setUserAnswer("");
    setDecisionAnswer(null);
    setCheckError(null);
  };

  const currentHand =
    reviewState.mode === "active" || reviewState.mode === "feedback"
      ? reviewState.review.hands[reviewState.handIdx]
      : null;

  const currentQuestion =
    currentHand &&
    (reviewState.mode === "active" || reviewState.mode === "feedback")
      ? currentHand.questions[reviewState.questionIdx]
      : null;

  const isDecisionType = currentQuestion?.answer_type === "decision";

  const isLastQuestionInHand =
    reviewState.mode === "feedback" &&
    currentHand !== null &&
    reviewState.questionIdx === currentHand.questions.length - 1;

  const isLastHand =
    reviewState.mode === "feedback" &&
    reviewState.handIdx === reviewState.review.hands.length - 1;

  return (
    <div className="bg-surface rounded-lg p-4 border border-surface-raised">
      <h3 className="text-stone-200 font-semibold mb-4">Session Reviews</h3>

      {/* Session List */}
      {reviewState.mode === "list" && (
        <div>
          {sessionsLoading && (
            <p className="text-stone-400 text-sm">Loading sessions...</p>
          )}
          {sessionsError && (
            <p className="text-red-400 text-sm">{sessionsError}</p>
          )}
          {checkError && <p className="text-red-400 text-sm">{checkError}</p>}
          {!sessionsLoading && !sessionsError && completedSessions.length === 0 && (
            <p className="text-stone-400 text-sm">
              No completed sessions to review.
            </p>
          )}
          {completedSessions.length > 0 && (
            <div className="space-y-2">
              {completedSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between bg-surface-deep rounded px-3 py-2"
                >
                  <div className="text-sm space-y-0.5">
                    <p className="text-stone-300">
                      {formatSessionDate(session.started_at)}
                    </p>
                    <p className="text-xs text-stone-400">
                      {session.total_rounds} round
                      {session.total_rounds !== 1 ? "s" : ""} &middot;{" "}
                      <span
                        className={`font-mono ${
                          session.total_profit >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {session.total_profit >= 0 ? "+" : ""}$
                        {session.total_profit.toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleStartReview(session.id)}
                    className="px-3 py-1.5 text-sm bg-gold text-stone-900 font-semibold rounded hover:bg-gold-400 cursor-pointer transition-colors duration-200"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading Review */}
      {reviewState.mode === "loading" && (
        <div className="text-stone-400 text-sm flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          Generating review...
        </div>
      )}

      {/* Active Question */}
      {reviewState.mode === "active" && currentHand && currentQuestion && (
        <div className="space-y-4">
          <div className="text-xs text-stone-400">
            Hand {reviewState.handIdx + 1} of{" "}
            {reviewState.review.hands.length} &middot; Question{" "}
            {reviewState.questionIdx + 1} of {currentHand.questions.length}
          </div>

          <HandScenario hand={currentHand} />

          <p className="text-stone-200 text-lg font-semibold">
            {currentQuestion.question_text}
          </p>

          {isDecisionType ? (
            <div>
              <label className="block text-xs text-stone-400 mb-2">
                Your Decision
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDecisionAnswer("call")}
                  className={`flex-1 px-4 py-2 text-sm rounded transition-colors duration-200 cursor-pointer ${
                    decisionAnswer === "call"
                      ? "bg-emerald-700 text-emerald-100 font-semibold"
                      : "bg-surface-raised text-stone-300 hover:bg-surface-hover"
                  }`}
                >
                  Call
                </button>
                <button
                  onClick={() => setDecisionAnswer("fold")}
                  className={`flex-1 px-4 py-2 text-sm rounded transition-colors duration-200 cursor-pointer ${
                    decisionAnswer === "fold"
                      ? "bg-red-700 text-red-100 font-semibold"
                      : "bg-surface-raised text-stone-300 hover:bg-surface-hover"
                  }`}
                >
                  Fold
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-stone-400 mb-1">
                Your Answer
              </label>
              <input
                type="number"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitAnswer();
                }}
                className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-sm font-mono text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200"
                placeholder="Enter your answer"
                autoFocus
              />
            </div>
          )}

          {checkError && <p className="text-red-400 text-sm">{checkError}</p>}

          <button
            onClick={handleSubmitAnswer}
            disabled={
              checkingAnswer ||
              (!isDecisionType && userAnswer === "") ||
              (isDecisionType && !decisionAnswer)
            }
            className="px-4 py-2 bg-gold text-stone-900 font-semibold rounded hover:bg-gold-400 cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkingAnswer ? "Checking..." : "Submit"}
          </button>
        </div>
      )}

      {/* Feedback */}
      {reviewState.mode === "feedback" && currentHand && currentQuestion && (
        <div className="space-y-4">
          <div className="text-xs text-stone-400">
            Hand {reviewState.handIdx + 1} of{" "}
            {reviewState.review.hands.length} &middot; Question{" "}
            {reviewState.questionIdx + 1} of {currentHand.questions.length}
          </div>

          <HandScenario hand={currentHand} />

          <p className="text-stone-200 text-lg font-semibold">
            {currentQuestion.question_text}
          </p>

          <div
            className={`rounded-lg p-4 border border-surface-raised space-y-2 ${
              reviewState.lastResult.is_correct ? "bg-emerald-900" : "bg-red-900"
            }`}
          >
            <p
              className={`font-semibold text-lg ${
                reviewState.lastResult.is_correct
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {reviewState.lastResult.is_correct ? "Correct!" : "Incorrect"}
            </p>
            <p className="text-stone-300 text-sm">
              Correct answer:{" "}
              <span className="font-mono font-semibold text-stone-200">
                {reviewState.lastResult.correct_answer}
              </span>
            </p>
            {reviewState.lastResult.explanation && (
              <p className="text-stone-400 text-sm">
                {reviewState.lastResult.explanation}
              </p>
            )}
          </div>

          <button
            onClick={handleNextQuestion}
            className="px-4 py-2 bg-gold text-stone-900 font-semibold rounded hover:bg-gold-400 cursor-pointer transition-colors duration-200"
          >
            {isLastQuestionInHand && isLastHand
              ? "See Summary"
              : isLastQuestionInHand
                ? "Next Hand"
                : "Next Question"}
          </button>
        </div>
      )}

      {/* Summary */}
      {reviewState.mode === "summary" && (
        <SummaryView
          review={reviewState.review}
          answers={reviewState.answers}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
