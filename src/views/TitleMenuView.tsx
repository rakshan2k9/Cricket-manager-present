import { useEffect, useState } from 'react';
import {
  Play,
  Users,
  Settings,
  Award,
  LogOut,
  ChevronRight,
  Info,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { League } from '../types/game';
import { getCountryFlag } from '../utils/format';

export function TitleMenuView({
  leagues,
  unreadSocialCount = 0,
  onPlay,
  onContinueLeague,
  onOpenSettings,
  onOpenFriends,
}: {
  leagues: League[];
  unreadSocialCount?: number;
  onPlay: () => void;
  onContinueLeague: (leagueId: number) => void;
  onOpenSettings: () => void;
  onOpenFriends: () => void;
}) {
  const { profile, signOut } = useAuth();
  const [hoveredKey, setHoveredKey] = useState<string>(leagues.length > 0 ? 'continue' : 'play');
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  const latestLeague = leagues[0] || null;

  const menuItems = [
    ...(latestLeague
      ? [
          {
            id: 'continue',
            label: `CONTINUE`,
            sublabel: latestLeague.name,
            icon: ChevronRight,
            onClick: () => onContinueLeague(latestLeague.id),
          },
        ]
      : []),
    {
      id: 'play',
      label: 'PLAY',
      icon: Play,
      onClick: onPlay,
    },
    {
      id: 'friends',
      label: 'FRIENDS & CHAT',
      icon: Users,
      onClick: onOpenFriends,
      badge: unreadSocialCount > 0 ? unreadSocialCount : undefined,
    },
    {
      id: 'settings',
      label: 'MANAGER & SETTINGS',
      icon: Settings,
      onClick: onOpenSettings,
    },
    {
      id: 'credits',
      label: 'CREDITS',
      icon: Award,
      onClick: () => setShowCreditsModal(true),
    },
    {
      id: 'signout',
      label: 'SIGN OUT',
      icon: LogOut,
      onClick: () => signOut(),
      muted: true,
    },
  ];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showCreditsModal) {
        if (e.key === 'Escape') setShowCreditsModal(false);
        return;
      }
      const idx = Math.max(0, menuItems.findIndex((m) => m.id === hoveredKey));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHoveredKey(menuItems[(idx + 1) % menuItems.length].id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHoveredKey(menuItems[(idx - 1 + menuItems.length) % menuItems.length].id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        menuItems[idx]?.onClick();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="min-h-screen bg-transparent text-slate-100 relative overflow-hidden flex flex-col justify-between select-none">
      {/* Crisp subtle diagonal pitch/stadium geometry line matching Reference Image 4 */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <path
          d="M 1010 0 L 892 565 L 892 900"
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1.25"
        />
      </svg>

      {/* Top right subtle info & manager indicator */}
      <div className="relative z-10 px-6 sm:px-14 pt-6 flex items-center justify-between">
        <div className="text-[11px] font-mono uppercase tracking-[0.26em] text-slate-500">
          {profile ? (
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <span>{getCountryFlag(profile.country)}</span>
              <span className="font-sans text-xs font-medium tracking-wide text-slate-300">
                {profile.preferredName || profile.managerName}
              </span>
            </button>
          ) : (
            <span>CRICKET MANAGER 27</span>
          )}
        </div>

        <button
          onClick={() => setShowCreditsModal(true)}
          className="w-7 h-7 rounded-full border border-white/30 hover:border-white text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Credits & Architecture"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Left-aligned CM27 Title & Vertical Menu exactly matching Reference Image 4 */}
      <div className="relative z-10 flex-1 max-w-[1440px] w-full mx-auto px-8 sm:px-16 flex items-center">
        <div className="w-full max-w-md space-y-7">
          <div>
            <p className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.30em] text-slate-400 mb-1.5">
              CRICKET MANAGER · MULTIPLAYER
            </p>
            <div className="flex items-baseline leading-none">
              <span className="font-condensed text-7xl sm:text-[84px] font-extrabold text-white tracking-tight">
                CM
              </span>
              <span className="font-condensed text-7xl sm:text-[84px] font-extrabold text-[#EAB308] tracking-tight">
                27
              </span>
            </div>
          </div>

          <nav className="space-y-0.5 max-w-[300px]">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = hoveredKey === item.id;
              return (
                <button
                  key={item.id}
                  onMouseEnter={() => setHoveredKey(item.id)}
                  onFocus={() => setHoveredKey(item.id)}
                  onClick={item.onClick}
                  data-active={isActive ? 'true' : 'false'}
                  className={`cm27-hover-sweep cm27-hover-bar w-full text-left pl-4 pr-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                    item.muted
                      ? 'text-slate-500 hover:text-rose-300 mt-3'
                      : isActive
                        ? 'text-white'
                        : 'text-slate-300/75 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? item.muted
                            ? 'text-rose-400'
                            : 'text-[#93E6EE]'
                          : 'text-slate-500'
                      }`}
                    />
                    <span className="font-condensed text-[26px] sm:text-[28px] font-bold tracking-wide uppercase leading-none whitespace-nowrap">
                      {item.label}
                    </span>
                    {'sublabel' in item && item.sublabel && (
                      <span className="text-xs font-sans font-medium text-slate-300 truncate">
                        · {item.sublabel}
                      </span>
                    )}
                  </span>

                  {'badge' in item && item.badge ? (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-400 text-[#0A0F12]">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom subtle caption */}
      <div className="relative z-10 px-6 sm:px-14 pb-6 flex items-center justify-between text-[11px] font-mono text-slate-500/80">
        <span>CRICKET MANAGER 27 · SEASON 2026/27</span>
        <span className="hidden sm:inline">CLICK PLAY OR CONTINUE TO ENTER HQ</span>
      </div>

      {/* Credits Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg cm27-panel p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-[#EAB308]">
                  CM27 EDITION
                </p>
                <h2 className="font-condensed text-3xl font-bold text-white uppercase">
                  Cricket Manager 27 Credits
                </h2>
              </div>
              <button
                onClick={() => setShowCreditsModal(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 cm27-panel-inset">
                <div className="text-slate-400">World Competitions</div>
                <div className="text-lg font-condensed font-bold text-[#EAB308] mt-0.5">
                  IPL · PSL · SA20 · BBL · 100 · Int&apos;l
                </div>
              </div>
              <div className="p-3 cm27-panel-inset">
                <div className="text-slate-400">Auction &amp; Match Sync</div>
                <div className="text-lg font-condensed font-bold text-[#4ADE80] mt-0.5">
                  Live Multiplayer PvP
                </div>
              </div>
              <div className="p-3 cm27-panel-inset">
                <div className="text-slate-400">Player Rating Model</div>
                <div className="text-lg font-condensed font-bold text-white mt-0.5">
                  Career &amp; Form Calibrated
                </div>
              </div>
              <div className="p-3 cm27-panel-inset">
                <div className="text-slate-400">Calendar Engine</div>
                <div className="text-lg font-condensed font-bold text-slate-200 mt-0.5">
                  IPL Schedule · 10m / Day
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowCreditsModal(false)}
                className="px-4 py-2 rounded cm27-btn-3d font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
