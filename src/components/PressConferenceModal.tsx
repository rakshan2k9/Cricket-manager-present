import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Mic,
  Newspaper,
  Quote,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  MatchRecord,
  PressConferenceQuestion,
  PressConferenceQuoteOption,
} from '../types/game';
import { apiFetch } from '../lib/api';

type Stance = 'measured' | 'assertive' | 'critical';

function buildClientFallbackOptions(
  match: MatchRecord,
  q: PressConferenceQuestion
): PressConferenceQuoteOption[] {
  const focus = q.targetPlayerName || 'our senior group';
  return [
    {
      stance: 'measured',
      quote: `We stay level regardless of the scorecard at ${match.venue} — we'll review our middle-over rotation calmly and build straight into the next round.`,
      impactTag: 'Squad Morale +2 · Board Reputation +1',
    },
    {
      stance: 'assertive',
      quote: `We back ${focus} and our match-winners to dominate big moments against any rival dugout in ${match.competitionLabel}.`,
      impactTag: 'Next-Match Press Edge · Sparks Rivalry',
    },
    {
      stance: 'critical',
      quote: `Standards slipped in key phases today — accountability starts with execution under pressure, and selection spots have to be earned.`,
      impactTag: 'Board Reputation +2 · Target Player Morale -8',
    },
  ];
}

export function PressConferencePanel({
  leagueId,
  match,
  onClose,
  onCompleted,
  onToast,
  mode = 'inline',
}: {
  leagueId: number;
  match: MatchRecord;
  onClose: () => void;
  onCompleted: () => Promise<void>;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; title: string; body?: string }) => void;
  mode?: 'inline' | 'modal';
}) {
  const [loading, setLoading] = useState(!match.pressConferenceJson?.questions?.length);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<PressConferenceQuestion[]>(
    match.pressConferenceJson?.questions || []
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [choices, setChoices] = useState<
    Record<string, { stance: Stance; quote: string }>
  >({});
  const [impactSummary, setImpactSummary] = useState<string | null>(
    match.pressConferenceJson?.overallImpactSummary || null
  );
  const [completed, setCompleted] = useState(Boolean(match.pressConferenceCompleted));

  useEffect(() => {
    let active = true;
    const preloaded = match.pressConferenceJson?.questions || [];
    if (preloaded.length >= 3) {
      setQuestions(preloaded);
      setCompleted(Boolean(match.pressConferenceCompleted));
      setImpactSummary(match.pressConferenceJson?.overallImpactSummary || null);
      setLoading(false);
      return;
    }

    setLoading(true);
    apiFetch<{
      pressConference: { questions: PressConferenceQuestion[]; overallImpactSummary?: string };
      completed: boolean;
    }>(`/api/leagues/${leagueId}/matches/${match.id}/press-conference`, {
      method: 'POST',
    })
      .then((res) => {
        if (!active) return;
        const qs = res.pressConference?.questions || [];
        setQuestions(qs);
        setCompleted(Boolean(res.completed));
        if (res.pressConference?.overallImpactSummary) {
          setImpactSummary(res.pressConference.overallImpactSummary);
        }
      })
      .catch((err: any) => {
        onToast?.({
          tone: 'error',
          title: 'Press room unavailable',
          body: err.message,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [leagueId, match.id, match.pressConferenceCompleted]);

  const handleSubmit = async (
    finalChoices: Record<string, { stance: Stance; quote: string }>
  ) => {
    if (questions.length === 0 || completed || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        pressConference: { questions: PressConferenceQuestion[]; overallImpactSummary?: string };
        impactSummary: string;
      }>(`/api/leagues/${leagueId}/matches/${match.id}/press-conference/answer`, {
        method: 'POST',
        body: JSON.stringify({
          answers: questions.map((q) => {
            const picked = finalChoices[q.id];
            const fallbackOpts = q.options?.length ? q.options : buildClientFallbackOptions(match, q);
            return {
              questionId: q.id,
              stance: picked?.stance || 'measured',
              quote: picked?.quote || fallbackOpts[0].quote,
            };
          }),
        }),
      });
      setQuestions(res.pressConference?.questions || questions);
      setImpactSummary(res.impactSummary);
      setCompleted(true);
      await onCompleted();
      onToast?.({
        tone: 'success',
        title: 'Published to The League Gazette',
        body: res.impactSummary,
      });
    } catch (err: any) {
      onToast?.({
        tone: 'error',
        title: 'Could not submit press answers',
        body: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickOption = (q: PressConferenceQuestion, opt: PressConferenceQuoteOption) => {
    if (completed || submitting) return;
    const nextChoices = {
      ...choices,
      [q.id]: { stance: opt.stance, quote: opt.quote },
    };
    setChoices(nextChoices);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx((idx) => idx + 1);
    } else {
      void handleSubmit(nextChoices);
    }
  };

  const activeQuestion = questions[currentIdx] || null;
  const activeOptions = activeQuestion
    ? activeQuestion.options?.length
      ? activeQuestion.options
      : buildClientFallbackOptions(match, activeQuestion)
    : [];

  return (
    <div
      className={`cm27-panel overflow-hidden border-[#93E6EE]/40 ${
        mode === 'modal' ? 'w-full max-w-3xl shadow-2xl' : 'w-full'
      }`}
    >
      {/* Top Broadcast Press Header */}
      <div className="px-6 py-4 bg-[#0B0F15] border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded bg-[#18202B] border border-[#93E6EE]/35 flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4 text-[#93E6EE]" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#93E6EE]">
              POST-MATCH PRESS CONFERENCE · {match.competitionLabel}
            </div>
            <h2 className="font-condensed text-2xl font-extrabold text-white uppercase truncate">
              {match.marginText || 'Post-Match Media Briefing'}
            </h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer shrink-0"
          aria-label="Close press conference"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {loading ? (
          <div className="py-10 text-center space-y-2">
            <Sparkles className="w-6 h-6 text-[#93E6EE] mx-auto" />
            <div className="text-sm font-semibold text-white">Preparing Media Pool Questions...</div>
            <p className="text-xs text-slate-400">
              Correspondents are finalizing questions on {match.venue} scorelines.
            </p>
          </div>
        ) : completed ? (
          <div className="space-y-4">
            {impactSummary && (
              <div className="p-3.5 rounded bg-[#11241B] border border-emerald-500/35 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
                  <span>
                    <strong>Gazette Impact:</strong> {impactSummary}
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase text-[#4ADE80] shrink-0">
                  ON RECORD
                </span>
              </div>
            )}

            <div className="space-y-2.5">
              {questions.map((q, idx) => (
                <div key={q.id} className="cm27-panel-inset p-4 space-y-2">
                  <div className="text-[11px] font-mono text-[#EAB308] font-bold">
                    Q{idx + 1} · {q.journalist} ({q.outlet})
                  </div>
                  <p className="text-xs text-slate-300">“{q.question}”</p>
                  {q.chosenQuote && (
                    <div className="p-3 rounded bg-[#0C1016] border-l-2 border-[#93E6EE]/60 text-xs text-white italic flex items-start gap-2">
                      <Quote className="w-3.5 h-3.5 text-[#93E6EE] shrink-0 mt-0.5" />
                      <span>{q.chosenQuote}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="cm27-btn-3d px-6 py-2.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Done · Close Briefing
              </button>
            </div>
          </div>
        ) : activeQuestion ? (
          <div className="space-y-5">
            {/* Sequential Question Stepper */}
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[#EAB308] tabular-nums">
                  QUESTION {currentIdx + 1} OF {questions.length}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  · {activeQuestion.journalist} ({activeQuestion.outlet})
                </span>
              </div>
              {activeQuestion.targetPlayerName && (
                <span className="text-xs font-mono text-[#93E6EE]">
                  Focus: {activeQuestion.targetPlayerName}
                </span>
              )}
            </div>

            {/* Question Text */}
            <p className="text-base sm:text-lg text-white font-medium leading-relaxed">
              “{activeQuestion.question}”
            </p>

            {/* 3 Spoken Manager Quotes (One-Click Sequential Advance) */}
            <div className="space-y-2.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Select Your Spoken Response On Camera
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {activeOptions.map((opt) => {
                  const isPicked = choices[activeQuestion.id]?.stance === opt.stance;
                  return (
                    <button
                      key={opt.stance}
                      type="button"
                      disabled={submitting}
                      onClick={() => handlePickOption(activeQuestion, opt)}
                      className={`cm27-hover-sweep w-full text-left p-4 rounded border transition-all cursor-pointer space-y-2 disabled:opacity-50 ${
                        isPicked
                          ? 'cm27-card-focus'
                          : 'bg-[#0D1117] border-white/10 hover:border-[#93E6EE]/60'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Quote className="w-4 h-4 text-[#93E6EE] shrink-0 mt-0.5" />
                        <p className="text-sm text-white leading-relaxed">“{opt.quote}”</p>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 pl-6.5">
                        Impact: <span className="text-[#93E6EE]">{opt.impactTag}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer Controls */}
            <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <ShieldAlert className="w-3.5 h-3.5 text-[#EAB308] shrink-0" />
                <span>
                  {submitting
                    ? 'Syndicating quotes to The League Gazette...'
                    : 'Your quote is syndicated directly to The League Gazette & dressing room.'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {currentIdx > 0 && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    className="cm27-btn-dark-3d px-3.5 py-2 rounded text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous Q</span>
                  </button>
                )}
                {currentIdx === questions.length - 1 && choices[activeQuestion.id] && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmit(choices)}
                    className="cm27-btn-3d px-5 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  >
                    <Newspaper className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Publishing...' : 'Deliver Statements'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PressConferenceModal({
  leagueId,
  match,
  onClose,
  onCompleted,
  onToast,
}: {
  leagueId: number;
  match: MatchRecord;
  onClose: () => void;
  onCompleted: () => Promise<void>;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; title: string; body?: string }) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-start justify-center pt-4 sm:pt-6 px-4 pb-6 overflow-y-auto cm27-view-enter">
      <PressConferencePanel
        leagueId={leagueId}
        match={match}
        onClose={onClose}
        onCompleted={onCompleted}
        onToast={onToast}
        mode="modal"
      />
    </div>
  );
}
