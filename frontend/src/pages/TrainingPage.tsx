import { useState, useEffect, useRef, useCallback } from "react";
import { useTrainingStore } from "../store/trainingStore";
import { useTraining } from "../hooks/useTraining";
import { formatCard } from "../utils/cardUtils";

const SKILL_LABELS: Record<string, string> = {
  outs: "Outs",
  rule_of_2_4: "Rule of 2 & 4",
  pot_odds: "Pot Odds",
  the_decision: "The Decision",
  spr_commitment: "SPR",
  bluff_math: "Bluff Math",
};

const ALL_SKILLS = Object.keys(SKILL_LABELS);
const TIMER_DURATION = 15;

function CardDisplay({ code, variant }: { code: string; variant: "hole" | "community" }) {
  const { rank, symbol, color } = formatCard(code);
  const bg = variant === "hole" ? "bg-gold-700" : "bg-emerald-900";
  return (
    <span className={`inline-flex items-center justify-center ${bg} rounded px-2 py-1 text-sm font-mono font-bold ${color}`}>
      {rank}{symbol}
    </span>
  );
}

function ScenarioDisplay() {
  const currentDrill = useTrainingStore((s) => s.currentDrill);
  if (!currentDrill) return null;

  const { scenario, question_text } = currentDrill;

  return (
    <div className="bg-surface rounded-lg p-4 border border-surface-raised space-y-3">
      {scenario.hole_cards && scenario.hole_cards.length > 0 && (
        <div>
          <span className="text-xs text-stone-400 mr-2">Hole Cards</span>
          <div className="inline-flex gap-1">
            {scenario.hole_cards.map((c) => (
              <CardDisplay key={c} code={c} variant="hole" />
            ))}
          </div>
        </div>
      )}

      {scenario.community_cards && scenario.community_cards.length > 0 && (
        <div>
          <span className="text-xs text-stone-400 mr-2">Board</span>
          <div className="inline-flex gap-1">
            {scenario.community_cards.map((c) => (
              <CardDisplay key={c} code={c} variant="community" />
            ))}
          </div>
        </div>
      )}

      {scenario.street && (
        <div className="text-xs text-stone-400">
          Street: <span className="text-stone-200 capitalize">{scenario.street}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-stone-400">
        {scenario.pot_size != null && (
          <span>Pot: <span className="font-mono text-stone-200">${scenario.pot_size}</span></span>
        )}
        {scenario.bet_to_call != null && (
          <span>Bet to call: <span className="font-mono text-stone-200">${scenario.bet_to_call}</span></span>
        )}
        {scenario.your_stack != null && (
          <span>Stack: <span className="font-mono text-stone-200">${scenario.your_stack}</span></span>
        )}
        {scenario.bluff_size != null && (
          <span>Bluff size: <span className="font-mono text-stone-200">${scenario.bluff_size}</span></span>
        )}
        {scenario.outs != null && (
          <span>Outs: <span className="font-mono text-stone-200">{scenario.outs}</span></span>
        )}
      </div>

      <p className="text-stone-200 text-lg font-semibold">{question_text}</p>
    </div>
  );
}

function TimerBar() {
  const timerRemaining = useTrainingStore((s) => s.timerRemaining);
  const fraction = timerRemaining / TIMER_DURATION;
  const pct = Math.max(0, Math.min(100, fraction * 100));

  return (
    <div className="w-full bg-surface-raised rounded-full h-1 overflow-hidden">
      <div
        className="h-1 rounded-full transition-all duration-200"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(to right, #b91c1c, #eab308, #d4a017)`,
          backgroundSize: "200% 100%",
          backgroundPosition: `${100 - pct}% 0`,
        }}
      />
    </div>
  );
}

function FeedbackDisplay() {
  const lastResult = useTrainingStore((s) => s.lastResult);
  if (!lastResult) return null;

  const isCorrect = lastResult.is_correct;
  const bgClass = isCorrect ? "bg-emerald-900" : "bg-red-900";
  const textClass = isCorrect ? "text-emerald-400" : "text-red-400";

  return (
    <div className={`${bgClass} rounded-lg p-4 border border-surface-raised space-y-2`}>
      <p className={`${textClass} font-semibold text-lg`}>
        {isCorrect ? "Correct!" : "Incorrect"}
      </p>
      <p className="text-stone-300 text-sm">
        Correct answer: <span className="font-mono font-semibold text-stone-200">{lastResult.correct_answer}</span>
      </p>
      {lastResult.explanation && (
        <p className="text-stone-400 text-sm">{lastResult.explanation}</p>
      )}
      <p className="text-stone-400 text-xs">
        Accuracy: <span className="font-mono text-stone-200">{(lastResult.accuracy_now * 100).toFixed(0)}%</span>
        {lastResult.graduated && (
          <span className="ml-2 text-gold font-semibold">Graduated!</span>
        )}
      </p>
    </div>
  );
}

export function TrainingPage() {
  const {
    currentDrill,
    lastResult,
    skillProgress,
    isGenerating,
    isChecking,
    speedMode,
    timerRemaining,
    mentalMathMode,
    selectedSkill,
    drillSource,
    setCurrentDrill,
    setLastResult,
    setSkillProgress,
    setIsGenerating,
    setIsChecking,
    setSpeedMode,
    setTimerRemaining,
    setTimerActive,
    setMentalMathMode,
    setSelectedSkill,
    setDrillSource,
    graduatedSkills,
  } = useTrainingStore();

  const { fetchProgress, generateDrill, checkDrill } = useTraining();
  const [userAnswer, setUserAnswer] = useState("");
  const [decisionAnswer, setDecisionAnswer] = useState<"call" | "fold" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drillStartTime = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch progress on mount
  useEffect(() => {
    fetchProgress().then((data) => {
      if (data) setSkillProgress(data);
    }).catch(() => {
      // Progress fetch failed silently; user can still generate drills
    });
  }, [fetchProgress, setSkillProgress]);

  // Timer logic
  useEffect(() => {
    if (speedMode && currentDrill && !lastResult) {
      setTimerRemaining(TIMER_DURATION);
      setTimerActive(true);

      timerRef.current = setInterval(() => {
        useTrainingStore.setState((state) => {
          const next = state.timerRemaining - 0.1;
          if (next <= 0) {
            return { timerRemaining: 0, timerActive: false };
          }
          return { timerRemaining: next };
        });
      }, 100);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [speedMode, currentDrill, lastResult, setTimerRemaining, setTimerActive]);

  // Auto-submit on timer expiry
  const handleSubmit = useCallback(async (overrideAnswer?: number) => {
    if (!currentDrill || isChecking) return;

    const answerType = currentDrill.answer_type;
    let answer: number;

    if (overrideAnswer !== undefined) {
      answer = overrideAnswer;
    } else if (answerType === "decision") {
      if (!decisionAnswer) return;
      answer = decisionAnswer === "call" ? 1 : 0;
    } else {
      const parsed = parseFloat(userAnswer);
      if (isNaN(parsed)) return;
      answer = parsed;
    }

    const elapsed = Date.now() - drillStartTime.current;

    setIsChecking(true);
    setError(null);
    try {
      const result = await checkDrill(currentDrill.drill_id, answer, elapsed);
      setLastResult(result);
      if (timerRef.current) clearInterval(timerRef.current);
      setTimerActive(false);
      // Refresh progress after checking
      fetchProgress().then((data) => {
        if (data) setSkillProgress(data);
      }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check answer");
    } finally {
      setIsChecking(false);
    }
  }, [currentDrill, isChecking, userAnswer, decisionAnswer, checkDrill, setIsChecking, setLastResult, setTimerActive, fetchProgress, setSkillProgress]);

  // Watch for timer hitting zero
  useEffect(() => {
    if (timerRemaining <= 0 && currentDrill && !lastResult && speedMode) {
      handleSubmit(-1);
    }
  }, [timerRemaining, currentDrill, lastResult, speedMode, handleSubmit]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setUserAnswer("");
    setDecisionAnswer(null);
    try {
      const drill = await generateDrill(selectedSkill, drillSource);
      setCurrentDrill(drill);
      drillStartTime.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate drill");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNextDrill = () => {
    setCurrentDrill(null);
    setLastResult(null);
    setUserAnswer("");
    setDecisionAnswer(null);
    setError(null);
  };

  const graduated = graduatedSkills();

  const getSkillStatus = (skill: string): "locked" | "active" | "graduated" => {
    if (graduated.has(skill)) return "graduated";
    const progress = skillProgress.find((p) => p.skill === skill);
    if (progress && progress.total_attempts > 0) return "active";
    return "active"; // All skills available for MVP
  };

  const isDecisionType = currentDrill?.answer_type === "decision";
  const drillActive = currentDrill && !lastResult;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-stone-200">Training</h2>

      {/* Skill Selector */}
      <div>
        <label className="block text-xs text-stone-400 mb-2">Skill</label>
        <div className="flex flex-wrap gap-2">
          {ALL_SKILLS.map((skill) => {
            const status = getSkillStatus(skill);
            const isSelected = selectedSkill === skill;
            const isLocked = status === "locked";

            let className =
              "px-3 py-1.5 text-sm rounded transition-colors duration-200";

            if (isLocked) {
              className += " bg-surface-raised text-stone-500 opacity-50 cursor-not-allowed";
            } else if (isSelected) {
              className += " bg-gold text-stone-900 font-semibold cursor-pointer";
            } else {
              className += " bg-surface-raised text-stone-300 hover:bg-surface-hover cursor-pointer";
            }

            return (
              <button
                key={skill}
                onClick={() => !isLocked && setSelectedSkill(skill)}
                disabled={isLocked}
                className={className}
              >
                {SKILL_LABELS[skill]}
                {status === "graduated" && (
                  <span className="ml-1.5 text-xs bg-gold-700 text-stone-100 rounded px-1.5 py-0.5">
                    Graduated
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Source Toggle */}
        <div>
          <label className="block text-xs text-stone-400 mb-1">Source</label>
          <div className="flex">
            <button
              onClick={() => setDrillSource("random")}
              className={`px-3 py-1.5 text-sm rounded-l border border-surface-raised transition-colors duration-200 cursor-pointer ${
                drillSource === "random"
                  ? "bg-gold text-stone-900 font-semibold"
                  : "bg-surface-raised text-stone-300 hover:bg-surface-hover"
              }`}
            >
              Random
            </button>
            <button
              onClick={() => setDrillSource("history")}
              className={`px-3 py-1.5 text-sm rounded-r border border-surface-raised border-l-0 transition-colors duration-200 cursor-pointer ${
                drillSource === "history"
                  ? "bg-gold text-stone-900 font-semibold"
                  : "bg-surface-raised text-stone-300 hover:bg-surface-hover"
              }`}
            >
              From History
            </button>
          </div>
        </div>

        {/* Speed Mode Toggle */}
        <div>
          <label className="block text-xs text-stone-400 mb-1">Speed Mode</label>
          <button
            onClick={() => setSpeedMode(!speedMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors duration-200 cursor-pointer ${
              speedMode
                ? "bg-gold text-stone-900 font-semibold"
                : "bg-surface-raised text-stone-300 hover:bg-surface-hover"
            }`}
          >
            <span>15s</span>
          </button>
        </div>

        {/* Mental Math Mode Toggle */}
        <div>
          <label className="block text-xs text-stone-400 mb-1">Mental Math</label>
          <button
            onClick={() => setMentalMathMode(!mentalMathMode)}
            className={`px-3 py-1.5 text-sm rounded transition-colors duration-200 cursor-pointer ${
              mentalMathMode
                ? "bg-gold text-stone-900 font-semibold"
                : "bg-surface-raised text-stone-300 hover:bg-surface-hover"
            }`}
          >
            {mentalMathMode ? "On" : "Off"}
          </button>
        </div>
      </div>

      {/* Generate Button */}
      {!drillActive && !lastResult && (
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-gold text-stone-900 font-semibold rounded hover:bg-gold-400 cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? "Generating..." : "Generate Drill"}
        </button>
      )}

      {/* Error Display */}
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {/* Timer Bar */}
      {speedMode && drillActive && (
        <TimerBar />
      )}

      {/* Scenario Display */}
      {currentDrill && <ScenarioDisplay />}

      {/* Answer Input */}
      {drillActive && (
        <div className="bg-surface rounded-lg p-4 border border-surface-raised space-y-3">
          {isDecisionType ? (
            <div>
              <label className="block text-xs text-stone-400 mb-2">Your Decision</label>
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
              <label className="block text-xs text-stone-400 mb-1">Your Answer</label>
              <input
                type="number"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-sm font-mono text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200"
                placeholder="Enter your answer"
                autoFocus
              />
            </div>
          )}

          <button
            onClick={() => handleSubmit()}
            disabled={isChecking || (!isDecisionType && userAnswer === "") || (isDecisionType && !decisionAnswer)}
            className="px-4 py-2 bg-gold text-stone-900 font-semibold rounded hover:bg-gold-400 cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? "Checking..." : "Submit"}
          </button>
        </div>
      )}

      {/* Feedback Display */}
      {lastResult && (
        <>
          <FeedbackDisplay />
          <button
            onClick={handleNextDrill}
            className="px-4 py-2 bg-gold text-stone-900 font-semibold rounded hover:bg-gold-400 cursor-pointer transition-colors duration-200"
          >
            Next Drill
          </button>
        </>
      )}
    </div>
  );
}
