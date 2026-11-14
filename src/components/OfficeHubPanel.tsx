import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  CalendarDays,
  Coins,
  Plus,
  Shield,
  Target,
  Trophy,
} from 'lucide-react';
import type { CurrencyCode, LeagueStateSnapshot, ManagerProfile, Player } from '../types/game';
import {
  buildCalendarMonthGrid,
  computeBoardObjectives,
  computeBudgetBreakdown,
  computeManagerCareerStats,
} from '../utils/officeMetrics';
import { formatCurrencyLakhs, getFormatDisplayLabel, getPlayerOverall } from '../utils/format';
import { TeamCrest } from './TeamCrest';
import { ManagerBadge } from './ManagerBadge';
import { CountryFlag } from './CountryFlag';
import type { ActiveTab } from './AppShell';

export type OfficeSubScreen =
  | 'hub'
  | 'objectives'
  | 'standings'
  | 'calendar'
  | 'budget'
  | 'career';

export function OfficeHubPanel({
  leagueState,
  profile,
  currency,
  topPlayers,
  onNavigate,
  onInspectTeam,
}: {
  leagueState: LeagueStateSnapshot;
  profile: ManagerProfile | null;
  currency: CurrencyCode;
  topPlayers: Player[];
  onNavigate?: (tab: ActiveTab) => void;
  onInspectTeam?: (teamId: number) => void;
}) {
  const [subScreen, setSubScreen] = useState<OfficeSubScreen>('hub');
  const currentGameDay = leagueState.currentGameDay || leagueState.league.currentGameDay || 1;
  const [selectedDay, setSelectedDay] = useState<number>(currentGameDay);

  const myTeam = leagueState.myTeam;
  const standings = leagueState.standings || [];
  const fixtures = leagueState.fixtures || [];
  const matches = leagueState.matches || [];

  const objectives = useMemo(
    () => computeBoardObjectives(standings, myTeam?.id, leagueState.teams.length || 8),
    [standings, myTeam?.id, leagueState.teams.length]
  );

  const budget = useMemo(
    () =>
      computeBudgetBreakdown(
        myTeam?.startingBudget ?? leagueState.league.startingBudget,
        myTeam?.remainingBudget ?? leagueState.league.startingBudget,
        44
      ),
    [myTeam?.startingBudget, myTeam?.remainingBudget, leagueState.league.startingBudget]
  );

  const calendarDays = useMemo(
    () => buildCalendarMonthGrid(fixtures, leagueState.teams, currentGameDay, myTeam?.id, 30),
    [fixtures, leagueState.teams, currentGameDay, myTeam?.id]
  );

  const careerStats = useMemo(
    () => computeManagerCareerStats(matches, myTeam?.id),
    [matches, myTeam?.id]
  );

  const teamMap = useMemo(
    () => new Map(leagueState.teams.map((t) => [t.id, t])),
    [leagueState.teams]
  );

  const upcomingMyFixtures = useMemo(() => {
    return fixtures
      .filter(
        (fx) =>
          fx.status !== 'completed' &&
          (!myTeam || fx.homeTeamId === myTeam.id || fx.awayTeamId === myTeam.id)
      )
      .slice(0, 3);
  }, [fixtures, myTeam]);

  const selectedDayInfo =
    calendarDays.find((d) => d.day === selectedDay) || calendarDays[0];

  useEffect(() => {
    if (subScreen === 'hub') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setSubScreen('hub');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [subScreen]);

  const statusTone =
    objectives.statusLabel === 'ON TRACK'
      ? 'border-[#4ADE80]/55 bg-[#4ADE80]/15 text-[#4ADE80]'
      : objectives.statusLabel === 'AT RISK'
        ? 'border-[#EAB308]/55 bg-[#EAB308]/15 text-[#EAB308]'
        : 'border-rose-500/55 bg-rose-500/15 text-rose-300';

  if (subScreen !== 'hub') {
    return (
      <div className="cm27-view-enter space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSubScreen('hub')}
            className="cm27-btn-dark-3d px-3.5 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Office Hub</span>
            <span className="cm27-keycap">Esc</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['objectives', 'Objectives'],
                ['standings', 'Standings'],
                ['calendar', 'Calendar'],
                ['budget', 'Budget'],
                ['career', 'My Career'],
              ] as Array<[OfficeSubScreen, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSubScreen(id)}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  subScreen === id
                    ? 'cm27-btn-3d'
                    : 'bg-[#0C1016] border border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* SUB-SCREEN 1: OBJECTIVES (Video 00:18) */}
        {subScreen === 'objectives' && (
          <div className="cm27-panel p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.07] pb-5">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#EAB308]">
                  BOARD MANDATE · SEASON 1
                </div>
                <h2 className="font-condensed text-4xl sm:text-5xl font-extrabold text-white uppercase tracking-wide mt-1">
                  OBJECTIVES
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1.5">{objectives.headline}</p>
              </div>
              <span
                className={`px-4 py-1.5 rounded-full border text-xs font-mono font-bold uppercase tracking-wider ${statusTone}`}
              >
                {objectives.statusLabel}
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-400">SEASON TARGET COMPLETION</span>
                <span className="text-white font-bold text-base">{objectives.progressPct}%</span>
              </div>
              <div className="h-3 rounded-full bg-[#090C11] border border-white/10 overflow-hidden">
                <div
                  className="cm27-bar-fill h-full rounded-full bg-gradient-to-r from-[#22C55E] via-[#4ADE80] to-[#93E6EE]"
                  style={{ width: `${objectives.progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="cm27-panel-inset p-4 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  TABLE POSITION
                </div>
                <div className="font-condensed text-3xl font-extrabold text-white tabular-nums">
                  {objectives.rank} / {objectives.totalTeams}
                </div>
                <div className="text-xs text-slate-400">
                  {myTeam ? myTeam.name : leagueState.league.name}
                </div>
              </div>
              <div className="cm27-panel-inset p-4 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  BOARD TARGET
                </div>
                <div className="font-condensed text-3xl font-extrabold text-[#EAB308]">1ST PLACE</div>
                <div className="text-xs text-slate-400">Automatic Playoff Top Seed</div>
              </div>
              <div className="cm27-panel-inset p-4 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  STANDINGS DELTA
                </div>
                <div className="font-condensed text-3xl font-extrabold text-[#4ADE80]">
                  {objectives.placesOff === 0 ? 'LEADING' : `${objectives.placesOff} OFF 1ST`}
                </div>
                <div className="text-xs text-slate-400">{objectives.detail}</div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-SCREEN 2: FULL STANDINGS */}
        {subScreen === 'standings' && (
          <div className="cm27-panel p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#93E6EE]">
                  LEAGUE TABLE
                </div>
                <h2 className="font-condensed text-3xl font-extrabold text-white uppercase tracking-wide">
                  STANDINGS &amp; NET RUN RATE
                </h2>
              </div>
              <span className="text-xs font-mono text-[#93E6EE]">TOP 4 PLAYOFF QUALIFICATION</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#090C11] text-[10px] font-mono uppercase text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">POS</th>
                    <th className="py-2.5 px-3">CLUB</th>
                    <th className="py-2.5 px-3 text-right">P</th>
                    <th className="py-2.5 px-3 text-right">W</th>
                    <th className="py-2.5 px-3 text-right">L</th>
                    <th className="py-2.5 px-3 text-right">T</th>
                    <th className="py-2.5 px-3 text-right">NRR</th>
                    <th className="py-2.5 px-3 text-right">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {standings.map((row, idx) => {
                    const isMine = myTeam?.id === row.teamId;
                    return (
                      <tr
                        key={row.teamId}
                        onClick={() => onInspectTeam?.(row.teamId)}
                        className={`cm27-hover-sweep cursor-pointer transition-colors ${
                          isMine ? 'bg-[#1D2532]/90 text-white' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold tabular-nums text-[#93E6EE]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <TeamCrest
                              templateKey={row.templateKey}
                              shortCode={row.shortCode}
                              primaryColor={row.primaryColor}
                              secondaryColor={row.secondaryColor}
                              size="sm"
                            />
                            <span className="font-semibold">{row.teamName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">{row.played}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-[#4ADE80]">
                          {row.won}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-rose-300">
                          {row.lost}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">{row.tied}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          {row.nrr >= 0 ? `+${row.nrr.toFixed(3)}` : row.nrr.toFixed(3)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white tabular-nums">
                          {row.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUB-SCREEN 3: CALENDAR MONTH GRID (Video 00:32–00:35) */}
        {subScreen === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Selected Day Spotlight */}
            <div className="lg:col-span-4 cm27-panel p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-400">
                  DAY {String(selectedDayInfo.day).padStart(2, '0')} BRIEFING
                </div>
                {selectedDayInfo.isToday && (
                  <span className="px-2.5 py-0.5 rounded bg-[#EAB308]/20 border border-[#EAB308]/60 text-[10px] font-mono font-bold text-[#EAB308]">
                    TODAY
                  </span>
                )}
              </div>

              {selectedDayInfo.fixture ? (
                <div className="space-y-4">
                  <div className="text-xs font-mono uppercase tracking-wider text-[#4ADE80]">
                    MATCHDAY · {getFormatDisplayLabel(selectedDayInfo.fixture.format)}
                  </div>
                  <h3 className="font-condensed text-3xl font-extrabold text-white uppercase leading-tight">
                    {selectedDayInfo.opponent
                      ? `${selectedDayInfo.isHome ? 'VS' : '@'} ${selectedDayInfo.opponent.name}`
                      : `Match #${selectedDayInfo.fixture.matchNumber}`}
                  </h3>
                  <div className="cm27-panel-inset p-3.5 space-y-1.5 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500">Venue:</span> {selectedDayInfo.fixture.venue}
                    </div>
                    <div>
                      <span className="text-slate-500">Pitch:</span>{' '}
                      {selectedDayInfo.fixture.pitchCondition}
                    </div>
                    <div>
                      <span className="text-slate-500">Status:</span>{' '}
                      <span className="uppercase font-mono text-[#93E6EE]">
                        {selectedDayInfo.fixture.status}
                      </span>
                    </div>
                  </div>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('matchday')}
                      className="cm27-btn-3d w-full py-2.5 rounded font-bold text-xs uppercase tracking-wider cursor-pointer"
                    >
                      Open Matchday Hub
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs font-mono uppercase tracking-wider text-[#93E6EE]">
                    REST &amp; PREPARATION DAY
                  </div>
                  <h3 className="font-condensed text-4xl font-extrabold text-white uppercase">
                    REST DAY
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    No league fixture scheduled on Day {selectedDayInfo.day}. Use this window for
                    Squad Development adjustments, Training Ground drills, or Scout Brief dispatches.
                  </p>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('training')}
                      className="cm27-btn-dark-3d w-full py-2.5 rounded font-semibold text-xs text-slate-200 cursor-pointer"
                    >
                      Run Conditioning / Skills Session
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right 7-Column 30-Day Schedule Grid */}
            <div className="lg:col-span-8 cm27-panel p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-condensed text-2xl font-extrabold text-white uppercase tracking-wide">
                  SEASON CALENDAR · DAYS 01–30
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  Click any day to inspect
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-mono uppercase text-slate-500 pb-1">
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
                <span>SUN</span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((cell) => {
                  const isSelected = cell.day === selectedDay;
                  const hasFixture = Boolean(cell.fixture);
                  return (
                    <button
                      key={cell.day}
                      type="button"
                      onClick={() => setSelectedDay(cell.day)}
                      className={`min-h-[68px] p-2 rounded-md border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'cm27-card-focus'
                          : cell.isToday
                            ? 'bg-[#1A160D]/85 border-[#EAB308]/75'
                            : hasFixture
                              ? 'bg-[#0F1B16]/80 border-[#4ADE80]/40 hover:border-[#4ADE80]/80'
                              : 'bg-[#0A0E14]/70 border-white/[0.06] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-mono font-bold tabular-nums ${
                            cell.isToday
                              ? 'text-[#EAB308]'
                              : hasFixture
                                ? 'text-[#4ADE80]'
                                : 'text-slate-300'
                          }`}
                        >
                          {String(cell.day).padStart(2, '0')}
                        </span>
                        {cell.isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
                        )}
                      </div>

                      {cell.fixture ? (
                        <div className="truncate">
                          <div className="text-[10px] font-bold text-white truncate">
                            {cell.opponent ? cell.opponent.shortCode : `M${cell.fixture.matchNumber}`}
                          </div>
                          <div className="text-[9px] font-mono text-[#4ADE80]">
                            {getFormatDisplayLabel(cell.fixture.format)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[9px] font-mono text-slate-600">Rest</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUB-SCREEN 4: BUDGET OVERVIEW WITH ANIMATED DONUT (Video 00:40) */}
        {subScreen === 'budget' && (
          <div className="cm27-panel p-6 sm:p-8 space-y-6">
            <div className="border-b border-white/[0.07] pb-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#4ADE80]">
                FRANCHISE TREASURY
              </div>
              <h2 className="font-condensed text-4xl font-extrabold text-white uppercase tracking-wide mt-1">
                BUDGET OVERVIEW
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-5 flex flex-col items-center justify-center p-4">
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
                    <circle
                      cx="55"
                      cy="55"
                      r="44"
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="12"
                    />
                    <circle
                      cx="55"
                      cy="55"
                      r="44"
                      fill="none"
                      stroke="#4ADE80"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${budget.remainingStrokeLength} ${budget.ringCircumference}`}
                      className="cm27-ring-stroke"
                    />
                    <circle
                      cx="55"
                      cy="55"
                      r="44"
                      fill="none"
                      stroke="#EAB308"
                      strokeWidth="12"
                      strokeDasharray={`${budget.spentStrokeLength} ${budget.ringCircumference}`}
                      strokeDashoffset={-budget.remainingStrokeLength}
                      className="cm27-ring-stroke"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-condensed text-4xl font-extrabold text-white tabular-nums leading-none">
                      {budget.remainingPct}%
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-1">
                      AVAILABLE
                    </span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="cm27-panel-inset p-4 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    BOARD ALLOCATION
                  </div>
                  <div className="font-condensed text-2xl font-extrabold text-white tabular-nums">
                    {formatCurrencyLakhs(budget.startingBudget, currency)}
                  </div>
                  <div className="text-[11px] text-slate-500">Season Salary Cap</div>
                </div>
                <div className="cm27-panel-inset p-4 space-y-1.5 border-[#4ADE80]/30">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#4ADE80]">
                    CURRENT BUDGET
                  </div>
                  <div className="font-condensed text-2xl font-extrabold text-[#4ADE80] tabular-nums">
                    {formatCurrencyLakhs(budget.remainingBudget, currency)}
                  </div>
                  <div className="text-[11px] text-slate-400">{budget.remainingPct}% unspent</div>
                </div>
                <div className="cm27-panel-inset p-4 space-y-1.5 border-[#EAB308]/30">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#EAB308]">
                    SPENT THIS SEASON
                  </div>
                  <div className="font-condensed text-2xl font-extrabold text-[#EAB308] tabular-nums">
                    {formatCurrencyLakhs(budget.spentBudget, currency)}
                  </div>
                  <div className="text-[11px] text-slate-400">{budget.spentPct}% committed</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-SCREEN 5: MY CAREER DOSSIER (Video 00:49) */}
        {subScreen === 'career' && (
          <div className="cm27-panel p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
              <div className="flex items-center gap-4">
                <ManagerBadge
                  name={profile?.preferredName || profile?.managerName || 'Gaffer'}
                  country={profile?.country || 'England'}
                  accent={profile?.avatarUrl || 'cyan'}
                  size="lg"
                />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#93E6EE]">
                    MANAGER CAREER DOSSIER
                  </div>
                  <h2 className="font-condensed text-4xl font-extrabold text-white uppercase tracking-wide">
                    {profile?.preferredName || profile?.managerName || 'Manager'}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
                    <CountryFlag country={profile?.country || 'England'} size="xs" />
                    <span>{profile?.coachExperience}</span>
                    <span className="text-slate-600">·</span>
                    <span>{profile?.coachingStyle}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  CURRENT CLUB
                </div>
                <div className="font-condensed text-2xl font-extrabold text-[#EAB308] uppercase">
                  {myTeam ? myTeam.name : 'Unattached'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="cm27-panel-inset p-4">
                <div className="text-[10px] font-mono uppercase text-slate-400">WIN RATE %</div>
                <div className="font-condensed text-4xl font-extrabold text-[#4ADE80] mt-1 tabular-nums">
                  {careerStats.winPct}%
                </div>
              </div>
              <div className="cm27-panel-inset p-4">
                <div className="text-[10px] font-mono uppercase text-slate-400">MATCHES</div>
                <div className="font-condensed text-4xl font-extrabold text-white mt-1 tabular-nums">
                  {careerStats.matchesPlayed}
                </div>
              </div>
              <div className="cm27-panel-inset p-4">
                <div className="text-[10px] font-mono uppercase text-slate-400">HOME WIN %</div>
                <div className="font-condensed text-4xl font-extrabold text-[#93E6EE] mt-1 tabular-nums">
                  {careerStats.homeWinPct}%
                </div>
              </div>
              <div className="cm27-panel-inset p-4">
                <div className="text-[10px] font-mono uppercase text-slate-400">AWAY WIN %</div>
                <div className="font-condensed text-4xl font-extrabold text-white mt-1 tabular-nums">
                  {careerStats.awayWinPct}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="cm27-panel-inset p-4 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  CLUBS MANAGED
                </div>
                <div className="text-sm font-bold text-white">
                  {myTeam ? `${myTeam.name} (${myTeam.shortCode})` : 'Awaiting Franchise Claim'}
                </div>
                <div className="text-xs text-slate-400">
                  Reputation Rating: <strong className="text-[#EAB308]">{profile?.reputation ?? 50}/100</strong>
                </div>
              </div>

              <div className="cm27-panel-inset p-4 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  TROPHY CABINET
                </div>
                <div className="font-condensed text-2xl font-extrabold text-[#EAB308] tabular-nums">
                  {myTeam?.trophiesCount ?? 0} HONOURS
                </div>
                <div className="text-xs text-slate-400">
                  {(myTeam?.historicalTitlesJson || []).slice(0, 2).join(' · ') || 'Pre-season campaign active'}
                </div>
              </div>

              <div className="cm27-panel-inset p-4 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  BEST ACCOLADES
                </div>
                <div className="text-sm font-bold text-white">
                  {profile?.favoriteFormat || 'T20'} Specialist
                </div>
                <div className="text-xs text-slate-400">{profile?.coachBackground}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ================= MAIN 6-CARD CM27 OFFICE HUB STRIP (Video 00:15–00:54) ================= */
  return (
    <div className="cm27-view-enter space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#EAB308]">
            FRONT OFFICE OPERATIONS
          </p>
          <h1 className="font-condensed text-4xl font-extrabold text-white uppercase tracking-wide leading-none mt-1">
            OFFICE HUB
          </h1>
        </div>
        <div className="text-xs font-mono text-slate-400">
          {myTeam ? `${myTeam.name} (${myTeam.shortCode})` : leagueState.league.name} · Day{' '}
          {String(currentGameDay).padStart(2, '0')}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-stretch">
        {/* Card 1: OBJECTIVES */}
        <div className="cm27-panel cm27-hub-card cm27-stagger-1 p-4 min-h-[385px] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <span>OBJECTIVES</span>
              <Target className="w-3.5 h-3.5 text-[#4ADE80]" />
            </div>
            <div className="text-center py-6 space-y-2.5">
              <div className="font-condensed text-5xl font-extrabold text-white tabular-nums leading-none">
                {objectives.progressPct}%
              </div>
              <span
                className={`inline-block px-3 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase ${statusTone}`}
              >
                {objectives.statusLabel}
              </span>
            </div>
            <div className="cm27-panel-inset p-2.5 text-[11px] space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Position</span>
                <strong className="text-white font-mono">
                  {objectives.rank}/{objectives.totalTeams}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Target</span>
                <strong className="text-[#EAB308] font-mono">1st</strong>
              </div>
            </div>
          </div>
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setSubScreen('objectives')}
              className="cm27-pill-cta cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>Enter Objectives</span>
            </button>
          </div>
        </div>

        {/* Card 2: STANDINGS */}
        <div className="cm27-panel cm27-hub-card cm27-stagger-2 p-4 min-h-[385px] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <span>STANDINGS</span>
              <Trophy className="w-3.5 h-3.5 text-[#EAB308]" />
            </div>
            <div className="divide-y divide-white/[0.06]">
              {standings.slice(0, 5).map((row, idx) => (
                <div
                  key={row.teamId}
                  className={`py-2 px-1.5 rounded flex items-center justify-between text-xs ${
                    myTeam?.id === row.teamId ? 'bg-white/[0.06] text-white font-bold' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-slate-500 w-3 tabular-nums">
                      {idx + 1}
                    </span>
                    <TeamCrest
                      templateKey={row.templateKey}
                      shortCode={row.shortCode}
                      primaryColor={row.primaryColor}
                      secondaryColor={row.secondaryColor}
                      size="xs"
                    />
                    <span className="truncate">{row.shortCode}</span>
                  </div>
                  <span className="font-mono text-[11px] font-bold tabular-nums">{row.points}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setSubScreen('standings')}
              className="cm27-pill-cta cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>Enter Standings</span>
            </button>
          </div>
        </div>

        {/* Card 3: CALENDAR */}
        <div className="cm27-panel cm27-hub-card cm27-stagger-3 p-4 min-h-[385px] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <span>CALENDAR</span>
              <CalendarDays className="w-3.5 h-3.5 text-[#93E6EE]" />
            </div>
            <div className="cm27-panel-inset p-3 border-[#EAB308]/40">
              <div className="text-[10px] font-mono text-[#EAB308] uppercase">TODAY</div>
              <div className="font-condensed text-2xl font-extrabold text-white uppercase">
                DAY {String(currentGameDay).padStart(2, '0')}
              </div>
            </div>
            <div className="space-y-1.5">
              {upcomingMyFixtures.map((fx) => {
                const oppId =
                  myTeam && fx.homeTeamId === myTeam.id ? fx.awayTeamId : fx.homeTeamId;
                const opp = teamMap.get(oppId);
                return (
                  <div
                    key={fx.id}
                    className="cm27-panel-inset px-2.5 py-2 flex items-center justify-between text-[11px]"
                  >
                    <span className="font-mono text-[#4ADE80] tabular-nums">
                      D{String(fx.scheduledDay).padStart(2, '0')}
                    </span>
                    <span className="text-slate-200 font-semibold truncate mx-1.5">
                      vs {opp?.shortCode || 'TBD'}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">
                      {getFormatDisplayLabel(fx.format)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setSubScreen('calendar')}
              className="cm27-pill-cta cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>Enter Calendar</span>
            </button>
          </div>
        </div>

        {/* Card 4: BUDGET OVERVIEW */}
        <div className="cm27-panel cm27-hub-card cm27-stagger-4 p-4 min-h-[385px] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <span>BUDGET OVERVIEW</span>
              <Coins className="w-3.5 h-3.5 text-[#4ADE80]" />
            </div>

            <div className="flex justify-center py-2">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
                  <circle
                    cx="55"
                    cy="55"
                    r="44"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="12"
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r="44"
                    fill="none"
                    stroke="#4ADE80"
                    strokeWidth="12"
                    strokeDasharray={`${budget.remainingStrokeLength} ${budget.ringCircumference}`}
                    className="cm27-ring-stroke"
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r="44"
                    fill="none"
                    stroke="#EAB308"
                    strokeWidth="12"
                    strokeDasharray={`${budget.spentStrokeLength} ${budget.ringCircumference}`}
                    strokeDashoffset={-budget.remainingStrokeLength}
                    className="cm27-ring-stroke"
                  />
                </svg>
                <span className="absolute font-condensed text-xl font-extrabold text-white tabular-nums">
                  {budget.remainingPct}%
                </span>
              </div>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Board</span>
                <strong className="text-white font-mono tabular-nums">
                  {formatCurrencyLakhs(budget.startingBudget, currency)}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Remaining</span>
                <strong className="text-[#4ADE80] font-mono tabular-nums">
                  {formatCurrencyLakhs(budget.remainingBudget, currency)}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Spent</span>
                <strong className="text-[#EAB308] font-mono tabular-nums">
                  {formatCurrencyLakhs(budget.spentBudget, currency)}
                </strong>
              </div>
            </div>
          </div>
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setSubScreen('budget')}
              className="cm27-pill-cta cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>Enter Budget</span>
            </button>
          </div>
        </div>

        {/* Card 5: MY CAREER */}
        <div className="cm27-panel cm27-hub-card cm27-stagger-5 p-4 min-h-[385px] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <span>MY CAREER</span>
              <Award className="w-3.5 h-3.5 text-[#93E6EE]" />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <Shield className="w-5 h-5 text-[#93E6EE] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {profile?.preferredName || profile?.managerName || 'Gaffer'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {myTeam ? myTeam.name : 'Manager'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="cm27-panel-inset p-2.5 text-center">
                <div className="font-condensed text-2xl font-extrabold text-[#4ADE80] tabular-nums">
                  {careerStats.winPct}%
                </div>
                <div className="text-[9px] font-mono text-slate-400 uppercase">WIN %</div>
              </div>
              <div className="cm27-panel-inset p-2.5 text-center">
                <div className="font-condensed text-2xl font-extrabold text-white tabular-nums">
                  {careerStats.matchesPlayed}
                </div>
                <div className="text-[9px] font-mono text-slate-400 uppercase">MATCHES</div>
              </div>
            </div>

            <div className="cm27-panel-inset p-2.5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Trophies</span>
              <strong className="font-mono text-[#EAB308] tabular-nums">
                {myTeam?.trophiesCount ?? 0}
              </strong>
            </div>
          </div>
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setSubScreen('career')}
              className="cm27-pill-cta cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>Enter My Career</span>
            </button>
          </div>
        </div>

        {/* Card 6: PLAYER STATS */}
        <div className="cm27-panel cm27-hub-card cm27-stagger-6 p-4 min-h-[385px] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <span>PLAYER STATS</span>
              <BarChart3 className="w-3.5 h-3.5 text-[#EAB308]" />
            </div>

            <div className="space-y-1.5">
              {topPlayers.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="cm27-panel-inset px-2.5 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{p.name}</div>
                    <div className="text-[9px] font-mono text-slate-400">
                      {p.ownedByTeamShortCode || p.leagueOrigin}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#4ADE80] tabular-nums shrink-0">
                    {getPlayerOverall(p)}
                  </span>
                </div>
              ))}
              {topPlayers.length === 0 && (
                <div className="cm27-panel-inset p-3 text-[11px] text-slate-400">
                  Open World Player Database to filter form, ratings, and career stats.
                </div>
              )}
            </div>
          </div>
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={() => onNavigate?.('players')}
              className="cm27-pill-cta cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>Enter Player Stats</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
