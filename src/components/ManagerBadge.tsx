import React from 'react';
import { CountryFlag } from './CountryFlag';

export function ManagerBadge({
  name,
  country,
  accent,
  size = 'md',
}: {
  name?: string | null;
  country?: string | null;
  accent?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  const cleanName = (name || 'CM27 Manager').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : cleanName.slice(0, 2).toUpperCase();

  const palette =
    accent === 'crest:amber'
      ? 'from-amber-500/25 to-amber-900/40 border-amber-400/50 text-amber-300'
      : accent === 'crest:cyan'
        ? 'from-cyan-500/25 to-slate-900/60 border-cyan-400/50 text-cyan-300'
        : 'from-emerald-500/25 to-emerald-950/60 border-emerald-400/50 text-emerald-300';

  const boxClass =
    size === 'xs'
      ? 'w-7 h-7 text-[11px] rounded-md'
      : size === 'sm'
        ? 'w-9 h-9 text-xs rounded-lg'
        : size === 'lg'
          ? 'w-14 h-14 text-xl rounded-md'
          : 'w-11 h-11 text-sm rounded-md';

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`${boxClass} bg-gradient-to-br ${palette} border flex items-center justify-center font-condensed font-extrabold tracking-wide shadow-inner`}
      >
        {initials}
      </div>
      {country && size !== 'xs' && (
        <span className="absolute -bottom-1 -right-1">
          <CountryFlag country={country} size="xs" />
        </span>
      )}
    </div>
  );
}
