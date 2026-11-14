import type { Player } from '../types/game';
import { formatOvrWithDelta } from '../utils/format';
import { CountryFlag } from './CountryFlag';

function getBowlStyleShort(bowlingStyle: string): string {
  const s = (bowlingStyle || '').toLowerCase();
  if (!s || s === 'none' || s.includes('wicket')) return 'WK';
  if (s.includes('left-arm') && s.includes('fast')) return 'LF';
  if (s.includes('fast-medium') || s.includes('medium-fast')) return s.includes('left') ? 'LM' : 'RM';
  if (s.includes('fast')) return 'RF';
  if (s.includes('medium')) return s.includes('left') ? 'LM' : 'RM';
  if (s.includes('chinaman') || s.includes('unorthodox')) return 'LC';
  if (s.includes('orthodox') || (s.includes('left') && s.includes('spin'))) return 'SLA';
  if (s.includes('leg-break') || s.includes('leg break') || s.includes('leg-spin')) return 'LS';
  if (s.includes('off-break') || s.includes('off break') || s.includes('off-spin')) return 'OS';
  return 'OS';
}

function getOrderBracket(role: string, battingRating: number): string {
  if (role === 'Batsman' || role === 'Wicketkeeper') {
    return battingRating >= 74 ? 'TOP ORDER' : 'MIDDLE ORDER';
  }
  if (role === 'All-Rounder') return 'MIDDLE ORDER';
  return 'LOWER ORDER';
}

function getFormWord(form: number): string {
  if (form >= 78) return 'Peak';
  if (form >= 64) return 'Good';
  if (form >= 52) return 'Steady';
  return 'Rusty';
}

export function CyanPlayerCard({
  player,
  compact,
  slotNumber,
  isCaptain,
  isWicketkeeper,
}: {
  player: Player;
  compact?: boolean;
  slotNumber?: number;
  isCaptain?: boolean;
  isWicketkeeper?: boolean;
}) {
  const { ovr, delta } = formatOvrWithDelta(player);

  const initials = player.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  const vsPace = Math.min(92, Math.max(25, Math.round(player.battingRating * 0.96 + (player.consistency - 65) * 0.12)));
  const vsSpin = Math.min(92, Math.max(24, Math.round(player.battingRating * 0.68 + player.temperament * 0.3)));
  const mentalPhysical = Math.min(92, Math.max(40, Math.round((player.temperament + player.fitness) / 2)));

  const roleHeaderLabel =
    player.primaryRole === 'Bowler'
      ? `BOWL · ${slotNumber ?? 9} · ${getOrderBracket(player.primaryRole, player.battingRating)} · ${getBowlStyleShort(player.bowlingStyle)}`
      : player.primaryRole === 'Wicketkeeper'
        ? `WK · ${slotNumber ?? 5} · ${getOrderBracket(player.primaryRole, player.battingRating)} · ${player.battingHand === 'Left-hand' ? 'LHB' : 'RHB'}`
        : player.primaryRole === 'All-Rounder'
          ? `AR · ${slotNumber ?? 6} · ${getOrderBracket(player.primaryRole, player.battingRating)} · ${getBowlStyleShort(player.bowlingStyle)}`
          : `BAT · ${slotNumber ?? 3} · ${getOrderBracket(player.primaryRole, player.battingRating)} · ${player.battingHand === 'Left-hand' ? 'LHB' : 'RHB'}`;

  const skillBars =
    player.primaryRole === 'Bowler'
      ? [
          { label: 'Pace / Revs', val: Math.min(93, player.bowlingRating) },
          { label: 'Accuracy', val: Math.min(93, Math.round((player.bowlingRating + player.consistency) / 2)) },
          { label: 'Swing / Drift', val: Math.min(92, Math.round((player.bowlingRating * 0.7 + player.temperament * 0.3))) },
          { label: 'Variation', val: Math.min(92, Math.max(42, player.bowlingRating - 2)) },
          { label: 'Control', val: Math.min(93, Math.round((player.consistency + player.temperament) / 2)) },
          { label: 'Yorker / Death', val: Math.min(92, Math.round((player.bowlingRating * 0.65 + player.currentForm * 0.35))) },
        ]
      : player.primaryRole === 'All-Rounder'
        ? [
            { label: 'Timing & Shot Range', val: Math.min(93, player.battingRating) },
            { label: 'Power Hitting', val: Math.min(93, Math.round((player.battingRating + player.currentForm) / 2)) },
            { label: 'Bowling Execution', val: Math.min(93, player.bowlingRating) },
            { label: 'Accuracy & Control', val: Math.min(92, Math.round((player.bowlingRating + player.consistency) / 2)) },
            { label: 'Temperament', val: Math.min(92, player.temperament) },
            { label: 'Death Utility', val: Math.min(92, Math.round((player.battingRating + player.bowlingRating + player.fieldingRating) / 3)) },
          ]
        : [
            { label: 'Timing', val: Math.min(93, player.battingRating) },
            { label: 'Power', val: Math.min(93, Math.round((player.battingRating * 0.72 + player.currentForm * 0.28))) },
            { label: 'Placement', val: Math.min(92, Math.round((player.battingRating * 0.6 + player.temperament * 0.4))) },
            { label: 'Technique', val: Math.min(92, player.consistency) },
            { label: 'Running', val: Math.min(92, Math.round((player.fitness * 0.55 + player.fieldingRating * 0.45))) },
            { label: 'Shot Selection', val: Math.min(92, player.temperament) },
          ];

  const shownBars = compact ? skillBars.slice(0, 4) : skillBars;

  return (
    <div className="rounded-md border border-[#2DD4BF]/30 overflow-hidden bg-[#080E10] shadow-xl">
      {/* Cyan-Teal Header Gradient matching Reference Image 2 */}
      <div className="p-4 bg-gradient-to-br from-[#1B7B99] via-[#13596F] to-[#0D3B49] text-white">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[#060C0E]/70 border border-white/25 flex items-center justify-center shrink-0 relative">
              <span className="font-condensed text-base font-extrabold text-cyan-100 tracking-wide">
                {initials || 'CR'}
              </span>
              <span className="absolute -bottom-1 -right-1">
                <CountryFlag country={player.country} size="xs" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-condensed text-2xl font-extrabold uppercase tracking-tight leading-none truncate">
                  {player.name}
                </h3>
                {isCaptain && (
                  <span className="px-1.5 py-0.5 rounded bg-[#EAB308] text-[#060A0B] text-[9px] font-mono font-bold shrink-0">
                    C
                  </span>
                )}
                {isWicketkeeper && (
                  <span className="px-1.5 py-0.5 rounded bg-white text-[#060A0B] text-[9px] font-mono font-bold shrink-0">
                    WK
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono uppercase opacity-85 mt-1 truncate">
                {roleHeaderLabel}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[9px] font-mono uppercase tracking-wider opacity-80">OVR</div>
            <div className="font-condensed text-3xl sm:text-4xl font-extrabold leading-none tabular-nums flex items-baseline justify-end gap-1">
              <span>{ovr}</span>
              {delta !== 0 && (
                <span
                  className={`text-xs font-mono font-bold ${
                    delta > 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono opacity-85 mt-0.5 tabular-nums">
              POT {player.potential}
            </div>
          </div>
        </div>
      </div>

      {/* Meta Strip */}
      <div className="px-4 py-2 bg-[#060B0D] border-b border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
        <span>
          Form <strong className="text-white">{getFormWord(player.currentForm)}</strong>
        </span>
        <span>
          Stamina{' '}
          <strong
            className={`tabular-nums ${
              (player.stamina ?? 100) < 55
                ? 'text-rose-400'
                : (player.stamina ?? 100) < 75
                  ? 'text-[#EAB308]'
                  : 'text-[#4ADE80]'
            }`}
          >
            {player.stamina ?? 100}%
          </strong>
        </span>
        <span>
          Morale <strong className="text-[#EAB308] tabular-nums">{player.morale}</strong>
        </span>
        <span>
          Age <strong className="text-white tabular-nums">{player.age}</strong>
        </span>
      </div>

      {((player.injuryGamesRemaining ?? 0) > 0 || player.transferRequested) && (
        <div className="px-4 py-1.5 bg-rose-950/35 border-b border-rose-500/25 flex items-center justify-between text-[10px] font-mono">
          {(player.injuryGamesRemaining ?? 0) > 0 && (
            <span className="text-rose-300 uppercase">
              INJURED · {player.injuryStatus} ({player.injuryGamesRemaining}G)
            </span>
          )}
          {player.transferRequested && (
            <span className="text-amber-300 uppercase ml-auto">TRADE REQUESTED</span>
          )}
        </div>
      )}

      {/* 6 Attribute Tiles */}
      <div className="p-3.5 grid grid-cols-3 gap-2">
        {[
          { label: 'BATTING', val: player.battingRating },
          { label: 'BOWLING', val: player.bowlingRating },
          { label: 'VS PACE', val: vsPace },
          { label: 'VS SPIN', val: vsSpin },
          { label: 'FIELDING', val: player.fieldingRating },
          { label: 'MENTAL / PHYS', val: mentalPhysical },
        ].map((box) => (
          <div
            key={box.label}
            className="p-2.5 rounded bg-[#0A1114] border border-white/[0.07]"
          >
            <div className="font-condensed text-xl font-extrabold text-white leading-none tabular-nums">
              {box.val}
            </div>
            <div className="text-[9px] font-mono text-slate-400 mt-1 tracking-wider">
              {box.label}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Teal Skill Bars */}
      <div className="px-4 pb-4 space-y-2">
        {shownBars.map((bar) => (
          <div key={bar.label} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300">
                <strong className="font-mono text-white mr-2 tabular-nums">{bar.val}</strong>
                {bar.label}
              </span>
            </div>
            <div className="h-[3px] bg-white/10 rounded-sm overflow-hidden">
              <div
                className="h-full bg-[#2DD4BF] transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(8, bar.val))}%` }}
              />
            </div>
          </div>
        ))}

        {Array.isArray(player.traitsJson) && player.traitsJson.length > 0 && (
          <div className="pt-2 border-t border-white/[0.06] flex flex-wrap gap-1.5">
            {player.traitsJson.map((trait) => (
              <span
                key={trait}
                className="px-1.5 py-0.5 rounded bg-[#13262B] border border-[#2DD4BF]/35 text-[9px] font-mono uppercase tracking-wider text-[#93E6EE]"
              >
                {trait}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
