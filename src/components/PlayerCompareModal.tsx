import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Player } from '../types/game';
import {
  formatCurrencyLakhs,
  formatOvrWithDelta,
  getCountryFlag,
  getPlayerOverall,
} from '../utils/format';
import { useAuth } from '../context/AuthContext';

export function PlayerCompareModal({
  players,
  onClose,
}: {
  players: Player[];
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const currency = profile?.preferredCurrency || 'INR';

  useEffect(() => {
    if (!players.length) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [players.length, onClose]);

  if (!players.length) return null;

  const metricRows: Array<{
    label: string;
    getVal: (p: Player) => number | string;
    numeric?: boolean;
    getNum?: (p: Player) => number;
  }> = [
    { label: 'League Origin', getVal: (p) => p.leagueOrigin || 'World' },
    { label: 'Role', getVal: (p) => p.primaryRole },
    { label: 'Country', getVal: (p) => `${getCountryFlag(p.country)} ${p.country}` },
    { label: 'Age', getVal: (p) => p.age, numeric: true },
    {
      label: 'Overall Rating',
      getVal: (p) => formatOvrWithDelta(p).label,
      numeric: true,
      getNum: (p) => getPlayerOverall(p),
    },
    { label: 'Batting', getVal: (p) => p.battingRating, numeric: true },
    { label: 'Bowling', getVal: (p) => p.bowlingRating, numeric: true },
    { label: 'Fielding', getVal: (p) => p.fieldingRating, numeric: true },
    { label: 'Fitness', getVal: (p) => p.fitness, numeric: true },
    { label: 'Consistency', getVal: (p) => p.consistency, numeric: true },
    { label: 'Temperament', getVal: (p) => p.temperament, numeric: true },
    { label: 'Potential', getVal: (p) => p.potential, numeric: true },
    { label: 'Current Form', getVal: (p) => p.currentForm, numeric: true },
    { label: 'T20 Strike Rate', getVal: (p) => p.statsJson.t20.strikeRate, numeric: true },
    { label: 'T20 Economy', getVal: (p) => p.statsJson.t20.economy || '-', numeric: false },
    { label: 'Base Price', getVal: (p) => formatCurrencyLakhs(p.basePrice, currency) },
    { label: 'Market Value', getVal: (p) => formatCurrencyLakhs(p.marketValue, currency) },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto cm27-view-enter">
      <div className="cm27-panel w-full max-w-4xl overflow-hidden shadow-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#0B0F15]">
          <div>
            <h2 className="font-condensed text-2xl font-bold uppercase text-white tracking-wide">
              Player Comparison Matrix
            </h2>
            <p className="text-xs text-slate-400">
              Side-by-side scouting attribute and format breakdown
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
            aria-label="Close comparison"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#0C1016]">
                <th className="py-3 px-4 text-xs font-mono uppercase tracking-wider text-slate-400 w-44">
                  Metric
                </th>
                {players.map((p) => (
                  <th key={p.id} className="py-3 px-4 font-semibold text-white">
                    <div>
                      {getCountryFlag(p.country)} {p.name}
                    </div>
                    <div className="text-xs font-normal text-slate-400 mt-0.5">
                      {p.battingHand} · {p.leagueOrigin}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {metricRows.map((row) => {
                const numericVals = row.numeric
                  ? players.map((p) => (row.getNum ? row.getNum(p) : Number(row.getVal(p))))
                  : [];
                const maxVal =
                  row.numeric && row.label !== 'Age' ? Math.max(...numericVals) : null;

                return (
                  <tr key={row.label} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-4 text-xs font-medium text-slate-400">
                      {row.label}
                    </td>
                    {players.map((p, pIdx) => {
                      const val = row.getVal(p);
                      const cmpNum = numericVals[pIdx];
                      const isBest =
                        maxVal !== null &&
                        players.length > 1 &&
                        cmpNum === maxVal &&
                        numericVals.filter((v) => v === maxVal).length === 1;
                      return (
                        <td
                          key={p.id}
                          className={`py-2.5 px-4 ${
                            row.numeric ? 'font-mono tabular-nums' : ''
                          } ${isBest ? 'text-[#4ADE80] font-semibold' : 'text-slate-200'}`}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
