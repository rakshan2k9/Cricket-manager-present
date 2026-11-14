import { useMemo, useState } from 'react';
import { Mic, Newspaper, Quote, ShieldAlert, Sparkles, Trophy } from 'lucide-react';
import type { LeagueNewsItem, LeagueStateSnapshot, MatchRecord } from '../types/game';
import { formatTimeAgo } from '../utils/format';
import { PressConferencePanel } from '../components/PressConferenceModal';

type NewsCategoryFilter = 'all' | 'press' | 'upset' | 'injury' | 'training' | 'trade' | 'milestone';

const CATEGORY_LABELS: Record<NewsCategoryFilter, string> = {
  all: 'All Dispatches',
  press: 'Press Room',
  upset: 'Match Reports',
  milestone: 'Milestones',
  injury: 'Medical Desk',
  trade: 'Transfer Wire',
  training: 'Training Camp',
};

export function GazetteView({
  state,
  onRefreshState,
  onToast,
}: {
  state: LeagueStateSnapshot;
  onRefreshState: () => Promise<void>;
  onToast: (t: { tone: 'success' | 'error' | 'info' | 'warning'; title: string; body?: string }) => void;
}) {
  const [filter, setFilter] = useState<NewsCategoryFilter>('all');
  const [activePressMatch, setActivePressMatch] = useState<MatchRecord | null>(null);

  const newsFeed: LeagueNewsItem[] = state.newsFeed || [];
  const myTeam = state.myTeam;

  const filteredNews = useMemo(
    () =>
      filter === 'all' ? newsFeed : newsFeed.filter((item) => item.category === filter),
    [newsFeed, filter]
  );

  // Completed matches involving myTeam that haven't held a press conference yet
  const pendingPressMatches = useMemo(() => {
    if (!myTeam) return [];
    return (state.matches || []).filter(
      (m) =>
        (m.homeTeamId === myTeam.id || m.awayTeamId === myTeam.id) &&
        !m.pressConferenceCompleted
    );
  }, [state.matches, myTeam?.id]);

  const currentTopMatch = activePressMatch
    ? (state.matches || []).find((m) => m.id === activePressMatch.id) || activePressMatch
    : null;

  const leadStory = filteredNews[0] || null;
  const archiveStories = filteredNews.slice(1);

  return (
    <div className="space-y-5">
      {/* Top-Anchored One-by-One Press Conference (Zero Scrolling Required) */}
      {currentTopMatch && (
        <div className="cm27-view-enter">
          <PressConferencePanel
            leagueId={state.league.id}
            match={currentTopMatch}
            onClose={() => setActivePressMatch(null)}
            onCompleted={onRefreshState}
            onToast={onToast}
            mode="inline"
          />
        </div>
      )}

      {/* Masthead */}
      <div className="cm27-panel p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#EAB308]">
            OFFICIAL COMPETITION BROADSHEET · {state.league.name}
          </div>
          <h1 className="font-condensed text-3xl sm:text-4xl font-extrabold text-white uppercase leading-none mt-1">
            THE LEAGUE GAZETTE
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Press room quotes, injury bulletins, transfer requests, training breakthroughs &amp; match verdicts.
          </p>
        </div>

        {pendingPressMatches.length > 0 && !currentTopMatch && (
          <button
            onClick={() => setActivePressMatch(pendingPressMatches[0])}
            className="cm27-btn-3d px-4 py-2.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Address Press Conference ({pendingPressMatches.length})</span>
          </button>
        )}
      </div>

      {/* Subtle Press Conference Ready Strip */}
      {pendingPressMatches.length > 0 && !currentTopMatch && (
        <div className="cm27-panel-inset p-3.5 border-[#93E6EE]/35 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-200">
            <Mic className="w-4 h-4 text-[#93E6EE] shrink-0" />
            <span>
              <strong className="text-[#93E6EE] font-mono uppercase text-[11px] mr-1.5">
                {pendingPressMatches[0].pressConferenceJson?.questions?.length
                  ? 'Press Conference Ready ·'
                  : 'Preparing Questions ·'}
              </strong>
              Media awaiting comment on{' '}
              <strong className="text-white">{pendingPressMatches[0].marginText}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {pendingPressMatches.slice(0, 3).map((m) => (
              <button
                key={m.id}
                onClick={() => setActivePressMatch(m)}
                className="cm27-btn-dark-3d px-3 py-1.5 rounded text-[11px] font-mono text-[#93E6EE] cursor-pointer whitespace-nowrap shrink-0"
              >
                Address: {m.marginText.slice(0, 28)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(Object.keys(CATEGORY_LABELS) as NewsCategoryFilter[]).map((key) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3.5 py-2 rounded text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                active ? 'cm27-btn-3d' : 'cm27-btn-dark-3d text-slate-300'
              }`}
            >
              {CATEGORY_LABELS[key]}
            </button>
          );
        })}
      </div>

      {filteredNews.length === 0 ? (
        <div className="cm27-panel p-12 text-center space-y-2">
          <Newspaper className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-sm font-semibold text-white">No Gazette Stories Yet</div>
          <p className="text-xs text-slate-400">
            Complete matches, attend post-match press briefings, train players, or finalize trades to populate headlines.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Lead Feature */}
          {leadStory && (
            <div className="lg:col-span-7 cm27-panel p-6 space-y-4 bg-gradient-to-br from-[#161C25] via-[#11151C] to-[#0C1016]">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
                <span className="text-[#EAB308] font-bold">
                  FRONT PAGE · {leadStory.category}
                </span>
                <span className="text-slate-400">{formatTimeAgo(leadStory.createdAt)}</span>
              </div>

              <h2 className="font-condensed text-3xl sm:text-4xl font-extrabold text-white uppercase leading-tight">
                {leadStory.headline}
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed">{leadStory.summary}</p>

              {leadStory.quote && (
                <div className="p-4 rounded bg-[#0C1016] border-l-2 border-[#93E6EE] flex items-start gap-3">
                  <Quote className="w-4 h-4 text-[#93E6EE] shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-200 italic leading-relaxed">{leadStory.quote}</p>
                </div>
              )}

              <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>
                  {leadStory.teamShortCode ? `CLUB: ${leadStory.teamShortCode}` : state.league.name}
                  {leadStory.playerName ? ` · PLAYER: ${leadStory.playerName}` : ''}
                </span>
                <span>CM27 WIRE</span>
              </div>
            </div>
          )}

          {/* Secondary Feed */}
          <div className="lg:col-span-5 space-y-3">
            {archiveStories.length === 0 ? (
              <div className="cm27-panel p-6 text-xs text-slate-400 text-center">
                More breaking stories will appear here as the season unfolds.
              </div>
            ) : (
              archiveStories.map((story) => (
                <div key={story.id} className="cm27-panel p-4 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase">
                    <span className="inline-flex items-center gap-1.5 text-[#93E6EE] font-bold">
                      {story.category === 'injury' ? (
                        <ShieldAlert className="w-3 h-3 text-rose-400" />
                      ) : story.category === 'milestone' ? (
                        <Trophy className="w-3 h-3 text-[#EAB308]" />
                      ) : story.category === 'training' ? (
                        <Sparkles className="w-3 h-3 text-[#4ADE80]" />
                      ) : null}
                      {story.category}
                      {story.teamShortCode ? ` · ${story.teamShortCode}` : ''}
                    </span>
                    <span className="text-slate-500">{formatTimeAgo(story.createdAt)}</span>
                  </div>
                  <h3 className="font-condensed text-xl font-bold text-white uppercase leading-snug">
                    {story.headline}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{story.summary}</p>
                  {story.quote && (
                    <div className="text-[11px] text-slate-400 italic border-l-2 border-white/15 pl-2.5">
                      {story.quote}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
