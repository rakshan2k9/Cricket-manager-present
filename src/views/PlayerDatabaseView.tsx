import React, { useCallback, useEffect, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, GitCompare, Search, Target, Upload, X } from 'lucide-react';
import type { LeagueStateSnapshot, Player } from '../types/game';
import { apiFetch } from '../lib/api';
import {
  formatCurrencyLakhs,
  formatOvrWithDelta,
  getCountryFlag,
} from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { PlayerProfileModal } from '../components/PlayerProfileModal';
import { PlayerCompareModal } from '../components/PlayerCompareModal';
import { TeamCrest } from '../components/TeamCrest';
import { CountryFlag } from '../components/CountryFlag';

const LEAGUE_ORIGINS = [
  'ALL',
  'IPL',
  'PSL',
  'SA20',
  'International',
  'BBL',
  'The Hundred',
];

export function PlayerDatabaseView({
  state,
  playersVersion,
  onRefreshLeague,
  onToast,
}: {
  state: LeagueStateSnapshot;
  playersVersion: number;
  onRefreshLeague?: () => Promise<void>;
  onToast: (t: { tone: 'success' | 'error' | 'info'; title: string; body?: string }) => void;
}) {
  const { profile } = useAuth();
  const currency = profile?.preferredCurrency || 'INR';
  const { league, teams, myTeam } = state;
  const isHost = league.myRole === 'host';
  const bookmarkedIds = myTeam?.bookmarkedPlayerIdsJson || [];
  const [bookmarkBusyId, setBookmarkBusyId] = useState<number | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState('');
  const [role, setRole] = useState('ALL');
  const [leagueOrigin, setLeagueOrigin] = useState('ALL');
  const [country, setCountry] = useState('ALL');
  const [availability, setAvailability] = useState('all');
  const [minBat, setMinBat] = useState(0);
  const [minBowl, setMinBowl] = useState(0);
  const [maxAge, setMaxAge] = useState(45);
  const [sortBy, setSortBy] = useState('overall');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modals & Comparison
  const [selectedProfile, setSelectedProfile] = useState<Player | null>(null);
  const [compareList, setCompareList] = useState<Player[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  // Importer
  const [showImport, setShowImport] = useState(false);
  const [importSourceLabel, setImportSourceLabel] = useState('Licensed Custom Roster');
  const [importText, setImportText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [focusedRowIdx, setFocusedRowIdx] = useState(0);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        q,
        role,
        leagueOrigin,
        country,
        availability,
        minBat: String(minBat),
        minBowl: String(minBowl),
        maxAge: String(maxAge),
        sortBy,
        sortDir,
      });
      const data = await apiFetch<{
        players: Player[];
        total: number;
        totalPages: number;
        countries: string[];
      }>(`/api/leagues/${league.id}/players?${params.toString()}`);

      setPlayers(data.players);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setCountries(data.countries);
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Player Query Failed', body: err.message });
    } finally {
      setLoading(false);
    }
  }, [
    league.id,
    page,
    q,
    role,
    leagueOrigin,
    country,
    availability,
    minBat,
    minBowl,
    maxAge,
    sortBy,
    sortDir,
    onToast,
  ]);

  useEffect(() => {
    loadPlayers();
    setFocusedRowIdx(0);
  }, [loadPlayers, playersVersion]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedProfile) {
          setSelectedProfile(null);
          return;
        }
        if (showCompare) {
          setShowCompare(false);
          return;
        }
        if (showImport) {
          setShowImport(false);
          return;
        }
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || selectedProfile || showCompare || showImport) {
        return;
      }
      if (players.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedRowIdx((i) => (i + 1) % players.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedRowIdx((i) => (i - 1 + players.length) % players.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = players[focusedRowIdx];
        if (target) setSelectedProfile(target);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [players, focusedRowIdx, selectedProfile, showCompare, showImport]);

  const toggleCompare = (p: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompareList((prev) => {
      if (prev.some((x) => x.id === p.id)) {
        return prev.filter((x) => x.id !== p.id);
      }
      if (prev.length >= 3) {
        onToast({ tone: 'info', title: 'Maximum 3 players can be compared simultaneously.' });
        return prev;
      }
      return [...prev, p];
    });
  };

  const handleToggleBookmark = async (p: Player, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!myTeam) {
      onToast({
        tone: 'error',
        title: 'Claim a club first',
        body: 'Claim a club in Teams before bookmarking auction targets.',
      });
      return;
    }
    setBookmarkBusyId(p.id);
    try {
      const res = await apiFetch<{ bookmarked: boolean; playerName: string }>(
        `/api/leagues/${league.id}/teams/${myTeam.id}/bookmarks/toggle`,
        {
          method: 'POST',
          body: JSON.stringify({ playerId: p.id }),
        }
      );
      if (onRefreshLeague) await onRefreshLeague();
      onToast({
        tone: res.bookmarked ? 'success' : 'info',
        title: res.bookmarked ? `Bookmarked ${res.playerName}` : `Removed ${res.playerName}`,
        body: res.bookmarked ? 'Added to your Auction Targets list.' : undefined,
      });
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Bookmark failed', body: err.message });
    } finally {
      setBookmarkBusyId(null);
    }
  };

  const parseImportContent = (raw: string) => {
    setImportError(null);
    const trimmed = raw.trim();
    if (!trimmed) {
      setParsedPreview([]);
      return;
    }
    try {
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        const arr = Array.isArray(parsed) ? parsed : parsed.players || [parsed];
        setParsedPreview(arr);
      } else {
        const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2)
          throw new Error('CSV must include a header row and at least one player.');
        const headers = lines[0].split(',').map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const vals = line.split(',').map((v) => v.trim());
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => {
            obj[h] = vals[i] ?? '';
          });
          return obj;
        });
        setParsedPreview(rows);
      }
    } catch (err: any) {
      setImportError(err.message || 'Invalid JSON or CSV format.');
      setParsedPreview([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setImportText(content);
      parseImportContent(content);
    };
    reader.readAsText(file);
  };

  const loadSampleTemplate = () => {
    const sample = `name,country,primaryRole,age,battingHand,bowlingStyle,battingRating,bowlingRating,fieldingRating,basePrice
Siddharth Deshmukh,India,Batsman,24,Right-hand,None,84,25,78,150
Callum Whitaker,England,All-Rounder,26,Left-hand,Right-arm fast-medium,79,81,82,150
Lachlan Carmichael,Australia,Bowler,23,Right-hand,Left-arm fast-medium,32,86,74,100`;
    setImportText(sample);
    parseImportContent(sample);
  };

  const commitImport = async () => {
    if (!parsedPreview.length) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await apiFetch<{ importedCount: number }>(
        `/api/leagues/${league.id}/players/import`,
        {
          method: 'POST',
          body: JSON.stringify({
            sourceLabel: importSourceLabel,
            players: parsedPreview,
          }),
        }
      );
      setShowImport(false);
      setImportText('');
      setParsedPreview([]);
      await loadPlayers();
      onToast({
        tone: 'success',
        title: `Imported ${res.importedCount} Players`,
        body: 'Players added to catalog and queued for auction.',
      });
    } catch (err: any) {
      setImportError(err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#EAB308]">
            GLOBAL PLAYER REGISTRY
          </p>
          <h1 className="text-3xl font-condensed font-bold uppercase tracking-tight text-white">
            World Player Database
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            {total} authentic players indexed · IPL, PSL, SA20, International Full Members, BBL &amp;
            The Hundred
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {compareList.length > 0 && (
            <button
              onClick={() => setShowCompare(true)}
              className="cm27-btn-dark-3d cm27-card-focus flex items-center gap-2 px-4 py-2 rounded text-[#93E6EE] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <GitCompare className="w-4 h-4" />
              Compare ({compareList.length}/3)
            </button>
          )}
          {isHost && (
            <button
              onClick={() => setShowImport(true)}
              className="cm27-btn-3d flex items-center gap-2 px-4 py-2 rounded text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              Import JSON / CSV
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="cm27-panel p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Role Segmented Filter */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0C1016] border border-white/[0.08] rounded">
            {['ALL', 'Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'].map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRole(r);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  role === r
                    ? 'cm27-btn-3d font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r === 'ALL' ? 'All Roles' : r}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search Kohli, Dhoni, Root, Bumrah..."
              className="w-full pl-9 pr-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#93E6EE]"
            />
          </div>
        </div>

        {/* League Origin Filter Strip */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/[0.06]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mr-2">
            Competition:
          </span>
          {LEAGUE_ORIGINS.map((origin) => (
            <button
              key={origin}
              onClick={() => {
                setLeagueOrigin(origin);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 border ${
                leagueOrigin === origin
                  ? 'cm27-card-focus text-[#93E6EE] font-semibold'
                  : 'bg-[#0C1016] text-slate-400 border-white/[0.08] hover:text-white'
              }`}
            >
              {origin === 'ALL' ? 'All Leagues' : origin}
            </button>
          ))}
        </div>

        {/* Secondary Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-white/[0.06]">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Country</label>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded bg-[#0C0F14] border border-white/15 text-xs text-white focus:outline-none focus:border-[#93E6EE]"
            >
              <option value="ALL">All Countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {getCountryFlag(c)} {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Availability</label>
            <select
              value={availability}
              onChange={(e) => {
                setAvailability(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded bg-[#0C0F14] border border-white/15 text-xs text-white focus:outline-none focus:border-[#93E6EE]"
            >
              <option value="all">All Players</option>
              <option value="available">Available Pool</option>
              <option value="owned">Signed to Clubs</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Min Batting</label>
            <input
              type="number"
              min={0}
              max={99}
              value={minBat}
              onChange={(e) => {
                setMinBat(Number(e.target.value));
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded bg-[#0C0F14] border border-white/15 text-xs font-mono text-white tabular-nums focus:outline-none focus:border-[#93E6EE]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Min Bowling</label>
            <input
              type="number"
              min={0}
              max={99}
              value={minBowl}
              onChange={(e) => {
                setMinBowl(Number(e.target.value));
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded bg-[#0C0F14] border border-white/15 text-xs font-mono text-white tabular-nums focus:outline-none focus:border-[#93E6EE]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Max Age</label>
            <input
              type="number"
              min={18}
              max={48}
              value={maxAge}
              onChange={(e) => {
                setMaxAge(Number(e.target.value) || 45);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded bg-[#0C0F14] border border-white/15 text-xs font-mono text-white tabular-nums focus:outline-none focus:border-[#93E6EE]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Sort By</label>
            <div className="flex gap-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded bg-[#0C0F14] border border-white/15 text-xs text-white focus:outline-none focus:border-[#93E6EE]"
              >
                <option value="overall">Overall</option>
                <option value="batting">Batting</option>
                <option value="bowling">Bowling</option>
                <option value="potential">Potential</option>
                <option value="value">Value</option>
                <option value="age">Age</option>
                <option value="name">Name</option>
              </select>
              <button
                onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                className="cm27-btn-dark-3d px-2 py-1.5 rounded text-xs font-mono text-slate-300 hover:text-white cursor-pointer"
                title="Toggle sort direction"
              >
                {sortDir === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Player Table */}
      <div className="cm27-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs text-slate-400 bg-[#070B0D]">
                <th className="py-3 px-4 w-10">Cmp</th>
                <th className="py-3 px-2 w-10 text-center" title="Auction Target">
                  Tgt
                </th>
                <th className="py-3 px-4 font-medium">Player</th>
                <th className="py-3 px-3 font-medium">League</th>
                <th className="py-3 px-3 font-medium">Role</th>
                <th className="py-3 px-3 font-medium text-right">Age</th>
                <th className="py-3 px-3 font-medium text-right">BAT</th>
                <th className="py-3 px-3 font-medium text-right">BWL</th>
                <th className="py-3 px-3 font-medium text-right">POT</th>
                <th className="py-3 px-3 font-medium text-right">OVR</th>
                <th className="py-3 px-3 font-medium text-right">Value</th>
                <th className="py-3 px-4 font-medium text-right">Club</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={12} className="h-11 px-4">
                      <div className="h-3.5 bg-white/[0.04] rounded" />
                    </td>
                  </tr>
                ))
              ) : players.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-xs text-slate-400">
                    No players match your current filters.
                  </td>
                </tr>
              ) : (
                players.map((p, rowIdx) => {
                  const isCompared = compareList.some((c) => c.id === p.id);
                  const isBookmarked = bookmarkedIds.includes(p.id);
                  const isRowFocused = rowIdx === focusedRowIdx;
                  const ovrInfo = formatOvrWithDelta(p);
                  const club = p.ownedByTeamId
                    ? teams.find((t) => t.id === p.ownedByTeamId)
                    : null;
                  return (
                    <tr
                      key={p.id}
                      onMouseEnter={() => setFocusedRowIdx(rowIdx)}
                      onClick={() => {
                        setFocusedRowIdx(rowIdx);
                        setSelectedProfile(p);
                      }}
                      className={`cm27-hover-sweep cursor-pointer transition-colors ${
                        isCompared
                          ? 'bg-[#1D2834]/90'
                          : isRowFocused
                            ? 'bg-white/[0.06]'
                            : isBookmarked
                              ? 'bg-[#EAB308]/[0.06] hover:bg-[#EAB308]/[0.1]'
                              : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="py-2.5 px-4" onClick={(e) => toggleCompare(p, e)}>
                        <input
                          type="checkbox"
                          checked={isCompared}
                          onChange={() => {}}
                          aria-label={`Compare ${p.name}`}
                          className="w-3.5 h-3.5 accent-[#93E6EE] cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleBookmark(p, e)}
                          disabled={bookmarkBusyId === p.id}
                          title={isBookmarked ? 'Remove Target Bookmark' : 'Bookmark for Auction'}
                          className={`p-1.5 rounded border transition-colors cursor-pointer ${
                            isBookmarked
                              ? 'bg-[#EAB308]/20 border-[#EAB308]/60 text-[#EAB308]'
                              : 'bg-transparent border-transparent text-slate-500 hover:text-[#EAB308] hover:bg-white/5'
                          }`}
                        >
                          {isBookmarked ? (
                            <Target className="w-3.5 h-3.5" />
                          ) : (
                            <Bookmark className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <CountryFlag country={p.country} size="xs" />
                          <span>{p.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {p.country}
                          {p.isOverseas ? ' (OS)' : ''} · {p.battingHand}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-mono uppercase text-slate-300">
                          {p.leagueOrigin || 'World'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-300">{p.primaryRole}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {p.age}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">
                        {p.battingRating}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">
                        {p.bowlingRating}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#4ADE80]">
                        {p.potential}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-[#EAB308]">
                        {ovrInfo.ovr}
                        {ovrInfo.delta !== 0 && (
                          <span
                            className={`ml-0.5 text-[11px] ${
                              ovrInfo.delta > 0 ? 'text-[#4ADE80]' : 'text-rose-400'
                            }`}
                          >
                            ({ovrInfo.delta > 0 ? `+${ovrInfo.delta}` : ovrInfo.delta})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">
                        {formatCurrencyLakhs(p.marketValue, currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-xs">
                        {p.ownedByTeamShortCode ? (
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <TeamCrest
                              templateKey={club?.templateKey}
                              shortCode={p.ownedByTeamShortCode}
                              primaryColor={p.ownedByTeamColor || '#22C55E'}
                              secondaryColor={club?.secondaryColor}
                              size="xs"
                            />
                            <span className="font-mono font-semibold text-[#4ADE80]">
                              {p.ownedByTeamShortCode}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">Available</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-white/[0.08] bg-[#0B0F15] flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono tabular-nums">
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="cm27-btn-dark-3d flex items-center gap-1 px-3 py-1.5 rounded disabled:opacity-40 text-slate-200 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="cm27-btn-dark-3d flex items-center gap-1 px-3 py-1.5 rounded disabled:opacity-40 text-slate-200 cursor-pointer"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Pinned Bottom Player Spotlight Bar (Video 00:55–01:19) */}
      {players[focusedRowIdx] && (() => {
        const spotlight = players[focusedRowIdx];
        const spotOvr = formatOvrWithDelta(spotlight);
        const spotClub = spotlight.ownedByTeamId
          ? teams.find((t) => t.id === spotlight.ownedByTeamId)
          : null;
        const isSpotBookmarked = bookmarkedIds.includes(spotlight.id);
        return (
          <div
            key={spotlight.id}
            className="sticky bottom-3 z-20 cm27-panel cm27-slide-right px-5 py-3.5 border-white/15 flex flex-wrap items-center justify-between gap-4 shadow-2xl"
          >
            <div className="flex items-center gap-4 min-w-0">
              <CountryFlag country={spotlight.country} size="md" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#93E6EE]">
                  {spotlight.primaryRole} · AGE {spotlight.age} · {spotlight.leagueOrigin || 'WORLD'}
                </div>
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <h2 className="font-condensed text-2xl font-extrabold text-white uppercase tracking-wide leading-none truncate">
                    {spotlight.name}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {spotClub ? spotClub.name : 'Available Pool'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="hidden sm:flex items-center gap-4 text-xs font-mono tabular-nums text-slate-300 border-r border-white/10 pr-4">
                <span>
                  BAT <strong className="text-white">{spotlight.battingRating}</strong>
                </span>
                <span>
                  BWL <strong className="text-white">{spotlight.bowlingRating}</strong>
                </span>
                <span>
                  POT <strong className="text-[#4ADE80]">{spotlight.potential}</strong>
                </span>
                <span>
                  VAL{' '}
                  <strong className="text-[#EAB308]">
                    {formatCurrencyLakhs(spotlight.marketValue, currency)}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleToggleBookmark(spotlight)}
                disabled={bookmarkBusyId === spotlight.id}
                className={`cm27-btn-dark-3d px-3 py-2 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  isSpotBookmarked ? 'text-[#EAB308] border-[#EAB308]/50' : 'text-slate-200'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>{isSpotBookmarked ? 'Tracked' : 'Track'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedProfile(spotlight)}
                className="cm27-btn-3d px-3.5 py-2 rounded text-xs font-bold cursor-pointer"
              >
                Open Dossier
              </button>

              <div className="px-3.5 py-1.5 rounded-md border-2 border-[#4ADE80]/85 bg-[#091710] text-center shadow-[0_0_18px_rgba(74,222,128,0.22)]">
                <div className="text-[9px] font-mono uppercase tracking-wider text-[#4ADE80]">
                  OVR
                </div>
                <div className="font-condensed text-2xl font-extrabold text-[#4ADE80] leading-none tabular-nums">
                  {spotOvr.ovr}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedProfile && (
        <PlayerProfileModal
          player={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          isBookmarked={bookmarkedIds.includes(selectedProfile.id)}
          onToggleBookmark={() => handleToggleBookmark(selectedProfile)}
          bookmarkBusy={bookmarkBusyId === selectedProfile.id}
        />
      )}

      {showCompare && (
        <PlayerCompareModal players={compareList} onClose={() => setShowCompare(false)} />
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="cm27-panel w-full max-w-3xl overflow-hidden shadow-2xl my-auto">
            <div className="px-6 py-4 border-b border-white/[0.08] bg-[#070B0D] flex items-center justify-between">
              <div>
                <h2 className="text-base font-condensed uppercase tracking-wide font-bold text-white">
                  Import Custom Player Dataset (JSON / CSV)
                </h2>
                <p className="text-xs text-slate-400">
                  Adds custom player records to this league catalog and auction pool
                </p>
              </div>
              <button
                onClick={() => setShowImport(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Dataset Source Label
                  </label>
                  <input
                    type="text"
                    value={importSourceLabel}
                    onChange={(e) => setImportSourceLabel(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Upload File (.csv or .json)
                  </label>
                  <input
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    onChange={handleFileUpload}
                    className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded file:border file:border-white/15 file:bg-[#19202B] file:text-[#93E6EE] file:cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Or Paste CSV / JSON Data
                  </label>
                  <button
                    type="button"
                    onClick={loadSampleTemplate}
                    className="text-xs text-[#93E6EE] hover:underline cursor-pointer"
                  >
                    Load Sample CSV Template
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    parseImportContent(e.target.value);
                  }}
                  placeholder="Paste CSV with header row or JSON array of player objects..."
                  className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#93E6EE]"
                />
              </div>

              {importError && (
                <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {importError}
                </div>
              )}

              {parsedPreview.length > 0 && (
                <div className="border border-white/[0.08] rounded overflow-hidden">
                  <div className="px-3 py-2 bg-[#070B0D] text-xs text-slate-300 border-b border-white/[0.06]">
                    Preview: {parsedPreview.length} players ready to import
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-slate-400 bg-[#070B0D]/60">
                        <tr>
                          <th className="py-1.5 px-3">Name</th>
                          <th className="py-1.5 px-3">Country</th>
                          <th className="py-1.5 px-3">Role</th>
                          <th className="py-1.5 px-3 text-right">BAT</th>
                          <th className="py-1.5 px-3 text-right">BWL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {parsedPreview.slice(0, 8).map((r, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-3 text-white">{r.name}</td>
                            <td className="py-1.5 px-3 text-slate-300">{r.country || 'India'}</td>
                            <td className="py-1.5 px-3 text-slate-300">
                              {r.primaryRole || 'Batsman'}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                              {r.battingRating || 68}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                              {r.bowlingRating || 55}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImport(false)}
                  className="px-4 py-2 text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importing || parsedPreview.length === 0}
                  onClick={commitImport}
                  className="cm27-btn-3d px-5 py-2 rounded disabled:opacity-50 font-bold text-xs cursor-pointer"
                >
                  {importing ? 'Importing...' : `Commit ${parsedPreview.length} Players`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
