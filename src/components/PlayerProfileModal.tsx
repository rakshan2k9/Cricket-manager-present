import { useEffect, useState } from 'react';
import { Bookmark, Target, Trophy, X } from 'lucide-react';
import type { Player } from '../types/game';
import { formatCurrencyLakhs, formatOvrWithDelta } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { CountryFlag } from './CountryFlag';

export function PlayerProfileModal({
  player,
  onClose,
  isBookmarked,
  onToggleBookmark,
  bookmarkBusy,
}: {
  player: Player;
  onClose: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  bookmarkBusy?: boolean;
}) {
  const { profile } = useAuth();
  const currency = profile?.preferredCurrency || 'INR';
  const [formatTab, setFormatTab] = useState<'t20' | 'odi' | 'test'>('t20');
  const stats = player.statsJson[formatTab];
  const ovrInfo = formatOvrWithDelta(player);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const tabs = ['t20', 'odi', 'test'] as const;
        const idx = tabs.indexOf(formatTab);
        const nextIdx =
          e.key === 'ArrowRight'
            ? (idx + 1) % tabs.length
            : (idx - 1 + tabs.length) % tabs.length;
        setFormatTab(tabs[nextIdx]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, formatTab]);

  const attributes = [
    { label: 'BATTING', value: player.battingRating },
    { label: 'BOWLING', value: player.bowlingRating },
    { label: 'FIELDING', value: player.fieldingRating },
    { label: 'FITNESS', value: player.fitness },
    { label: 'CONSISTENCY', value: player.consistency },
    { label: 'TEMPERAMENT', value: player.temperament },
    { label: 'POTENTIAL', value: player.potential },
    { label: 'CURRENT FORM', value: player.currentForm },
    { label: 'MORALE', value: player.morale },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto cm27-view-enter">
      <div className="cm27-panel w-full max-w-3xl overflow-hidden shadow-2xl my-auto">
        {/* Header Banner */}
        <div className="relative flex flex-col sm:flex-row gap-5 p-6 border-b border-white/[0.08] bg-[#0B0F15]">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {onToggleBookmark && (
              <button
                onClick={onToggleBookmark}
                disabled={bookmarkBusy}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
                  isBookmarked
                    ? 'bg-amber-500/15 border-[#EAB308] text-amber-300'
                    : 'cm27-btn-dark-3d text-slate-200 hover:border-[#EAB308]/50 hover:text-amber-300'
                }`}
                title={isBookmarked ? 'Remove from Auction Targets' : 'Bookmark for Live Auction'}
              >
                {isBookmarked ? (
                  <Target className="w-3.5 h-3.5 text-[#EAB308]" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
                <span>{isBookmarked ? 'Target Bookmarked' : 'Bookmark Target'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close profile"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="w-28 h-28 rounded border border-white/15 bg-[#0C1016] shrink-0 flex flex-col items-center justify-center gap-2 p-2.5">
            <CountryFlag
              country={player.country}
              size="lg"
              className="!w-20 !h-14 rounded border border-white/20"
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 text-center leading-tight truncate max-w-full">
              {player.country}
            </span>
          </div>

          <div className="flex-1 min-w-0 pr-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pr-24">
              <span className="text-[#93E6EE] font-semibold">{player.primaryRole}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <CountryFlag country={player.country} size="xs" />
                <span>{player.country}</span>
              </span>
              {player.isOverseas && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-sky-300">Overseas Slot</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] text-[#EAB308] uppercase">
                {player.leagueOrigin || 'Global Pool'}
              </span>
            </div>

            <h2 className="text-3xl font-condensed font-bold uppercase text-white mt-1 tracking-tight">
              {player.name}
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300 mt-1">
              <span>Age {player.age}</span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>{player.battingHand}</span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>{player.bowlingStyle}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-white/[0.08]">
              <div>
                <div className="text-xs text-slate-400">Overall Rating</div>
                <div className="text-xl font-mono font-bold text-[#EAB308] tabular-nums">
                  {ovrInfo.ovr}
                  {ovrInfo.delta !== 0 && (
                    <span
                      className={`ml-1 text-xs ${
                        ovrInfo.delta > 0 ? 'text-[#4ADE80]' : 'text-rose-400'
                      }`}
                    >
                      ({ovrInfo.delta > 0 ? `+${ovrInfo.delta}` : ovrInfo.delta})
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Base Price</div>
                <div className="text-lg font-mono font-semibold text-slate-100 tabular-nums">
                  {formatCurrencyLakhs(player.basePrice, currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Market Valuation</div>
                <div className="text-lg font-mono font-semibold text-slate-100 tabular-nums">
                  {formatCurrencyLakhs(player.marketValue, currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Club Contract</div>
                <div className="text-sm font-medium text-[#4ADE80] mt-0.5 truncate">
                  {player.ownedByTeamName
                    ? `${player.ownedByTeamShortCode} (${formatCurrencyLakhs(player.purchasePrice || player.basePrice, currency)})`
                    : 'Unassigned / Pool'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-300 cm27-panel-inset px-3.5 py-2.5">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-4 h-4 text-[#EAB308] shrink-0" />
              <span>
                {player.sourceLabel || `CM27 World Cricket Registry · ${player.leagueOrigin}`}
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
              <span
                className={
                  (player.stamina ?? 100) < 55
                    ? 'text-rose-400'
                    : (player.stamina ?? 100) < 75
                      ? 'text-[#EAB308]'
                      : 'text-[#4ADE80]'
                }
              >
                STAMINA {player.stamina ?? 100}%
              </span>
              {(player.injuryGamesRemaining ?? 0) > 0 && (
                <span className="text-rose-300">
                  OUT {player.injuryGamesRemaining}G ({player.injuryStatus})
                </span>
              )}
              {player.transferRequested && (
                <span className="text-amber-300">TRADE REQUESTED</span>
              )}
            </div>
          </div>

          {Array.isArray(player.traitsJson) && player.traitsJson.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Unlocked Traits:
              </span>
              {player.traitsJson.map((trait) => (
                <span
                  key={trait}
                  className="px-2 py-0.5 rounded bg-[#13262B] border border-[#2DD4BF]/35 text-[10px] font-mono uppercase tracking-wider text-[#93E6EE]"
                >
                  {trait}
                </span>
              ))}
            </div>
          )}

          {/* 9 Core Attributes */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
              Scouting Attributes
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {attributes.map((attr) => {
                const barColor =
                  attr.value >= 85
                    ? 'bg-[#93E6EE]'
                    : attr.value >= 72
                      ? 'bg-[#38BDF8]'
                      : 'bg-slate-500';
                return (
                  <div
                    key={attr.label}
                    className="p-3 cm27-panel-inset"
                  >
                    <div className="text-2xl font-condensed font-bold text-[#93E6EE] tabular-nums leading-none">
                      {attr.value}
                    </div>
                    <div className="text-[10px] font-mono text-slate-300 tracking-wider mt-1.5">
                      {attr.label}
                    </div>
                    <div className="h-1 bg-[#161C24] overflow-hidden mt-2">
                      <div
                        className={`h-full ${barColor}`}
                        style={{ width: `${attr.value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Format Stats */}
          <div className="pt-4 border-t border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200">Format Statistics</h3>
              <div className="flex items-center gap-4 border-b border-white/[0.08]">
                {(['t20', 'odi', 'test'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setFormatTab(fmt)}
                    className={`pb-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 -mb-[1px] ${
                      formatTab === fmt
                        ? 'border-[#93E6EE] text-white'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 cm27-panel-inset p-4">
              <div>
                <div className="text-xs text-slate-400">Matches</div>
                <div className="text-base font-mono font-semibold text-white tabular-nums mt-0.5">
                  {stats.matches}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Runs</div>
                <div className="text-base font-mono font-semibold text-white tabular-nums mt-0.5">
                  {stats.runs}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Bat Avg</div>
                <div className="text-base font-mono font-semibold text-white tabular-nums mt-0.5">
                  {stats.battingAvg}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Strike Rate</div>
                <div className="text-base font-mono font-semibold text-white tabular-nums mt-0.5">
                  {stats.strikeRate}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">100s / 50s</div>
                <div className="text-base font-mono font-semibold text-white tabular-nums mt-0.5">
                  {stats.hundreds} / {stats.fifties}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Wickets</div>
                <div className="text-base font-mono font-semibold text-white tabular-nums mt-0.5">
                  {stats.wickets}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Economy</div>
                <div className="text-base font-mono font-semibold text-white tabular-nums mt-0.5">
                  {stats.economy || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Bowl Avg</div>
                <div className="text-base font-mono font-semibold text-white tabular-nums mt-0.5">
                  {stats.bowlingAvg || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Best Figures</div>
                <div className="text-base font-mono font-semibold text-white tabular-nums mt-0.5">
                  {stats.bestBowling}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Fitness Status</div>
                <div className="text-sm font-medium text-[#4ADE80] mt-1">
                  {player.injuryStatus}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
