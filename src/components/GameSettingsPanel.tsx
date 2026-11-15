import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useSettings, type GameSettingsState } from '../context/SettingsContext';
import { formatMediaTime, stepClampedIndex } from '../utils/audioLogic';
import { soundEngine } from '../utils/soundEngine';

type SettingsTab = 'Gameplay' | 'Audio' | 'Display' | 'Controls';

interface SettingItemMeta {
  id: string;
  title: string;
  description: string;
}

const SETTING_META: Record<string, SettingItemMeta> = {
  musicEnabled: {
    id: 'musicEnabled',
    title: 'BACKGROUND MUSIC',
    description:
      'Enables or disables the persistent CM27 soundtrack channel independently from interface sound effects.',
  },
  musicVolume: {
    id: 'musicVolume',
    title: 'MUSIC VOLUME',
    description:
      'Controls the playback level (0–100) for the background MP3 player without affecting UI sound effects.',
  },
  muteMusic: {
    id: 'muteMusic',
    title: 'MUTE MUSIC',
    description:
      'Silences the background music stream instantly while keeping your saved music volume and leaving UI SFX active.',
  },
  radioPlayback: {
    id: 'radioPlayback',
    title: 'PLAYBACK & TRANSPORT',
    description:
      'Play, pause, skip forward/back, or scrub across the timeline. Playback continues uninterrupted across all tabs and screens.',
  },
  trackIndex: {
    id: 'trackIndex',
    title: 'ACTIVE SOUNDTRACK TRACK',
    description:
      'Switches between the 2 official CM27 soundtrack MP3s: Love Me Again (John Newman) and Feet Don\'t Fail Me Now (Joy Crookes).',
  },
  repeatMode: {
    id: 'repeatMode',
    title: 'REPEAT MODE',
    description:
      'Cycles playlist repeat behavior between Repeat All (loop playlist), Repeat One (loop current track), and Off.',
  },
  shuffleMode: {
    id: 'shuffleMode',
    title: 'SHUFFLE MODE',
    description:
      'Randomizes track progression when advancing to the next song in your soundtrack playlist.',
  },
  sfxEnabled: {
    id: 'sfxEnabled',
    title: 'UI SOUND EFFECTS',
    description:
      'Enables or disables preloaded local UI sound effects (clicks, tabs, arrows, toggles, match events) independently of background music.',
  },
  sfxVolume: {
    id: 'sfxVolume',
    title: 'SFX VOLUME',
    description:
      'Adjusts the output level (0–100) for preloaded UI sound effects independently from music playback.',
  },
  autoSaveDaily: {
    id: 'autoSaveDaily',
    title: 'AUTO-SAVE PROGRESSION',
    description:
      'Automatically persists squad lineups, training drills, and calendar progress to your league world after every action.',
  },
  confirmTacticalChanges: {
    id: 'confirmTacticalChanges',
    title: 'TACTICAL LOCK FEEDBACK',
    description:
      'Plays confirmation audio cues and displays status updates when adjusting live batting or bowling plans.',
  },
  matchCommentaryAudioCues: {
    id: 'matchCommentaryAudioCues',
    title: 'MATCHDAY AUDIO CUES',
    description:
      'Triggers crisp match-event sound effects on toss outcomes, key moments, boundaries, and wickets.',
  },
  compactScorecards: {
    id: 'compactScorecards',
    title: 'COMPACT SCORECARDS',
    description:
      'Uses higher-density batting and bowling scorecard tables during post-match reviews.',
  },
  showBroadcastAnimations: {
    id: 'showBroadcastAnimations',
    title: 'BROADCAST ANIMATIONS',
    description:
      'Enables smooth directional slide transitions and card illumination sweeps across the CM27 interface.',
  },
  highContrastBadges: {
    id: 'highContrastBadges',
    title: 'HIGH-CONTRAST FORMAT BADGES',
    description:
      'Renders vivid color-coded badges for T20, ODI, Test, and The Hundred fixtures on pre-match headers.',
  },
  keyboardShortcuts: {
    id: 'keyboardShortcuts',
    title: 'KEYBOARD NAVIGATION',
    description:
      'Enables arrow-key row navigation, Enter confirmation, and Esc back navigation across views.',
  },
  quickTabStepping: {
    id: 'quickTabStepping',
    title: 'Q / E TAB STEPPING',
    description:
      'Allows switching main header hubs using Q / E or [ / ] keys from anywhere in the league.',
  },
};

const TABS: SettingsTab[] = ['Gameplay', 'Audio', 'Display', 'Controls'];

const TAB_ROW_KEYS: Record<SettingsTab, string[]> = {
  Audio: [
    'musicEnabled',
    'musicVolume',
    'muteMusic',
    'trackIndex',
    'radioPlayback',
    'repeatMode',
    'shuffleMode',
    'sfxEnabled',
    'sfxVolume',
  ],
  Gameplay: ['autoSaveDaily', 'confirmTacticalChanges', 'matchCommentaryAudioCues'],
  Display: ['compactScorecards', 'showBroadcastAnimations', 'highContrastBadges'],
  Controls: ['keyboardShortcuts', 'quickTabStepping'],
};

function StepperRow({
  label,
  valueLabel,
  active,
  dots = 2,
  activeDot = 0,
  onFocus,
  onPrev,
  onNext,
  sfxMode = 'none',
}: {
  label: string;
  valueLabel: string;
  active: boolean;
  dots?: number;
  activeDot?: number;
  onFocus: () => void;
  onPrev: () => void;
  onNext: () => void;
  sfxMode?: string;
}) {
  return (
    <div
      onMouseEnter={onFocus}
      onClick={onFocus}
      data-sfx={sfxMode}
      className={`px-4 py-3 rounded-md border transition-all flex items-center justify-between gap-4 cursor-pointer ${
        active
          ? 'border-[#93E6EE] bg-[#101A22]/85 shadow-[0_0_18px_rgba(147,230,238,0.12)]'
          : 'border-transparent border-b-white/[0.06] hover:bg-white/[0.02]'
      }`}
    >
      <span className="text-xs sm:text-[13px] font-medium text-slate-200">{label}</span>
      <div className="flex flex-col items-center gap-1 min-w-[180px]">
        <div className="w-full flex items-center justify-between gap-3">
          <button
            type="button"
            data-sfx={sfxMode}
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
              onPrev();
            }}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
            aria-label={`Previous ${label}`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-white text-center truncate max-w-[140px]">
            {valueLabel}
          </span>
          <button
            type="button"
            data-sfx={sfxMode}
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
              onNext();
            }}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
            aria-label={`Next ${label}`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: dots }).map((_, i) => (
            <span
              key={i}
              className={`w-1 h-1 rounded-full ${i === activeDot ? 'bg-white' : 'bg-white/25'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  active,
  disabled = false,
  onFocus,
  onChange,
}: {
  label: string;
  value: number;
  active: boolean;
  disabled?: boolean;
  onFocus: () => void;
  onChange: (next: number) => void;
}) {
  return (
    <div
      onMouseEnter={onFocus}
      onClick={onFocus}
      data-sfx="none"
      className={`px-4 py-3 rounded-md border transition-all flex items-center justify-between gap-4 cursor-pointer ${
        active
          ? 'border-[#93E6EE] bg-[#101A22]/85 shadow-[0_0_18px_rgba(147,230,238,0.12)]'
          : 'border-transparent border-b-white/[0.06] hover:bg-white/[0.02]'
      } ${disabled ? 'opacity-55' : ''}`}
    >
      <span className="text-xs sm:text-[13px] font-medium text-slate-200">{label}</span>
      <div className="flex items-center gap-4 min-w-[170px] sm:min-w-[220px] justify-end">
        <input
          type="range"
          min={0}
          max={100}
          aria-label={label}
          value={value}
          onFocus={onFocus}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 sm:w-36 accent-[#93E6EE] h-1 bg-white/15 rounded-full cursor-pointer"
        />
        <span className="font-mono text-xs font-bold text-white tabular-nums w-7 text-right">
          {value}
        </span>
      </div>
    </div>
  );
}

export function GameSettingsPanel() {
  const {
    settings,
    currentTrack,
    tracks,
    musicPlayback,
    updateSetting,
    toggleRadio,
    nextTrack,
    prevTrack,
    selectTrack,
    seekMusic,
    cycleRepeatMode,
    toggleShuffle,
    resetDefaults,
  } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>('Audio');
  const [focusedKey, setFocusedKey] = useState<string>('musicEnabled');

  const rowKeys = useMemo(() => TAB_ROW_KEYS[activeTab], [activeTab]);

  const switchTab = (tab: SettingsTab) => {
    soundEngine.playTabSwitch();
    setActiveTab(tab);
    setFocusedKey(TAB_ROW_KEYS[tab][0]);
  };

  const stepTab = (delta: -1 | 1) => {
    const idx = TABS.indexOf(activeTab);
    const next = TABS[(idx + delta + TABS.length) % TABS.length];
    switchTab(next);
  };

  const toggleBoolWithSfx = (key: keyof GameSettingsState) => {
    const nextVal = !Boolean(settings[key]);
    updateSetting(key, nextVal as any);
    soundEngine.playToggle(nextVal);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const curIdx = Math.max(0, rowKeys.indexOf(focusedKey));
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const { nextIdx, moved } = stepClampedIndex(curIdx, delta, rowKeys.length);
        if (moved) {
          soundEngine.playNavArrow();
          setFocusedKey(rowKeys[nextIdx]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rowKeys, focusedKey]);

  const activeMeta = SETTING_META[focusedKey] || SETTING_META.musicEnabled;
  const repeatDotIdx = settings.repeatMode === 'off' ? 0 : settings.repeatMode === 'all' ? 1 : 2;
  const durationSec = musicPlayback.duration > 0 ? musicPlayback.duration : 0;
  const currentTimeSec = Math.min(durationSec || musicPlayback.currentTime, musicPlayback.currentTime);
  const progressPct =
    durationSec > 0 ? Math.min(100, Math.max(0, (currentTimeSec / durationSec) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Top Category Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-white/15 bg-white/[0.04] flex items-center justify-center text-slate-200">
            <Settings className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-sfx="none"
              onClick={() => stepTab(-1)}
              className="cm27-keycap cursor-pointer hover:border-white/35"
            >
              LB
            </button>
            {TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  data-sfx="none"
                  onClick={() => switchTab(tab)}
                  className={`relative px-3 py-1.5 text-xs sm:text-[13px] font-semibold cursor-pointer transition-colors ${
                    active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                  {active && (
                    <span className="absolute left-2 right-2 -bottom-0.5 h-[2px] bg-white rounded-full" />
                  )}
                </button>
              );
            })}
            <button
              type="button"
              data-sfx="none"
              onClick={() => stepTab(1)}
              className="cm27-keycap cursor-pointer hover:border-white/35"
            >
              RB
            </button>
          </div>
        </div>

        <button
          type="button"
          data-sfx="none"
          onClick={() => {
            resetDefaults();
            soundEngine.playConfirm();
          }}
          className="cm27-btn-dark-3d px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Main 12-Col Settings Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-5">
          {activeTab === 'Audio' && (
            <>
              {/* Independent Channel 1: BACKGROUND MUSIC */}
              <div className="space-y-1.5">
                <div className="px-4 text-[10px] font-mono uppercase tracking-[0.2em] text-[#93E6EE]">
                  BACKGROUND MUSIC
                </div>
                <StepperRow
                  label="Background Music"
                  valueLabel={settings.musicEnabled ? 'ON' : 'OFF'}
                  active={focusedKey === 'musicEnabled'}
                  dots={2}
                  activeDot={settings.musicEnabled ? 1 : 0}
                  onFocus={() => setFocusedKey('musicEnabled')}
                  onPrev={() => toggleBoolWithSfx('musicEnabled')}
                  onNext={() => toggleBoolWithSfx('musicEnabled')}
                />
                <SliderRow
                  label="Music Volume"
                  value={settings.musicVolume}
                  disabled={!settings.musicEnabled || settings.muteMusic}
                  active={focusedKey === 'musicVolume'}
                  onFocus={() => setFocusedKey('musicVolume')}
                  onChange={(v) => updateSetting('musicVolume', v)}
                />
                <StepperRow
                  label="Mute Music"
                  valueLabel={settings.muteMusic ? 'MUTED' : 'ACTIVE'}
                  active={focusedKey === 'muteMusic'}
                  dots={2}
                  activeDot={settings.muteMusic ? 1 : 0}
                  onFocus={() => setFocusedKey('muteMusic')}
                  onPrev={() => toggleBoolWithSfx('muteMusic')}
                  onNext={() => toggleBoolWithSfx('muteMusic')}
                />
                <StepperRow
                  label="Active Track"
                  valueLabel={currentTrack.title}
                  active={focusedKey === 'trackIndex'}
                  dots={tracks.length}
                  activeDot={settings.trackIndex % tracks.length}
                  sfxMode="confirm"
                  onFocus={() => setFocusedKey('trackIndex')}
                  onPrev={prevTrack}
                  onNext={nextTrack}
                />
                <StepperRow
                  label="Playback State"
                  valueLabel={musicPlayback.isPlaying ? 'PLAYING' : 'PAUSED'}
                  active={focusedKey === 'radioPlayback'}
                  dots={2}
                  activeDot={musicPlayback.isPlaying ? 1 : 0}
                  onFocus={() => setFocusedKey('radioPlayback')}
                  onPrev={() => {
                    toggleRadio();
                    soundEngine.playToggle(!settings.radioPlaying);
                  }}
                  onNext={() => {
                    toggleRadio();
                    soundEngine.playToggle(!settings.radioPlaying);
                  }}
                />
                <StepperRow
                  label="Repeat Mode"
                  valueLabel={settings.repeatMode.toUpperCase()}
                  active={focusedKey === 'repeatMode'}
                  dots={3}
                  activeDot={repeatDotIdx}
                  onFocus={() => setFocusedKey('repeatMode')}
                  onPrev={() => {
                    cycleRepeatMode();
                    soundEngine.playClick();
                  }}
                  onNext={() => {
                    cycleRepeatMode();
                    soundEngine.playClick();
                  }}
                />
                <StepperRow
                  label="Shuffle Mode"
                  valueLabel={settings.shuffleMode ? 'ON' : 'OFF'}
                  active={focusedKey === 'shuffleMode'}
                  dots={2}
                  activeDot={settings.shuffleMode ? 1 : 0}
                  onFocus={() => setFocusedKey('shuffleMode')}
                  onPrev={() => {
                    toggleShuffle();
                    soundEngine.playToggle(!settings.shuffleMode);
                  }}
                  onNext={() => {
                    toggleShuffle();
                    soundEngine.playToggle(!settings.shuffleMode);
                  }}
                />
              </div>

              {/* Independent Channel 2: UI SOUND EFFECTS */}
              <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                <div className="px-4 text-[10px] font-mono uppercase tracking-[0.2em] text-[#EAB308]">
                  UI SOUND EFFECTS (INDEPENDENT)
                </div>
                <StepperRow
                  label="UI Sound Effects"
                  valueLabel={settings.sfxEnabled ? 'ON' : 'OFF'}
                  active={focusedKey === 'sfxEnabled'}
                  dots={2}
                  activeDot={settings.sfxEnabled ? 1 : 0}
                  onFocus={() => setFocusedKey('sfxEnabled')}
                  onPrev={() => toggleBoolWithSfx('sfxEnabled')}
                  onNext={() => toggleBoolWithSfx('sfxEnabled')}
                />
                <SliderRow
                  label="SFX Volume"
                  value={settings.sfxVolume}
                  disabled={!settings.sfxEnabled}
                  active={focusedKey === 'sfxVolume'}
                  onFocus={() => setFocusedKey('sfxVolume')}
                  onChange={(v) => updateSetting('sfxVolume', v)}
                />
              </div>
            </>
          )}

          {activeTab === 'Gameplay' && (
            <div className="space-y-1.5">
              <div className="px-4 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                MATCHDAY &amp; CALENDAR
              </div>
              <StepperRow
                label="Auto-Save Daily Progress"
                valueLabel={settings.autoSaveDaily ? 'ON' : 'OFF'}
                active={focusedKey === 'autoSaveDaily'}
                dots={2}
                activeDot={settings.autoSaveDaily ? 1 : 0}
                onFocus={() => setFocusedKey('autoSaveDaily')}
                onPrev={() => toggleBoolWithSfx('autoSaveDaily')}
                onNext={() => toggleBoolWithSfx('autoSaveDaily')}
              />
              <StepperRow
                label="Tactical Lock Feedback"
                valueLabel={settings.confirmTacticalChanges ? 'ON' : 'OFF'}
                active={focusedKey === 'confirmTacticalChanges'}
                dots={2}
                activeDot={settings.confirmTacticalChanges ? 1 : 0}
                onFocus={() => setFocusedKey('confirmTacticalChanges')}
                onPrev={() => toggleBoolWithSfx('confirmTacticalChanges')}
                onNext={() => toggleBoolWithSfx('confirmTacticalChanges')}
              />
              <StepperRow
                label="Matchday Audio Cues"
                valueLabel={settings.matchCommentaryAudioCues ? 'ON' : 'OFF'}
                active={focusedKey === 'matchCommentaryAudioCues'}
                dots={2}
                activeDot={settings.matchCommentaryAudioCues ? 1 : 0}
                onFocus={() => setFocusedKey('matchCommentaryAudioCues')}
                onPrev={() => toggleBoolWithSfx('matchCommentaryAudioCues')}
                onNext={() => toggleBoolWithSfx('matchCommentaryAudioCues')}
              />
            </div>
          )}

          {activeTab === 'Display' && (
            <div className="space-y-1.5">
              <div className="px-4 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                BROADCAST PRESENTATION
              </div>
              <StepperRow
                label="Compact Scorecards"
                valueLabel={settings.compactScorecards ? 'ON' : 'OFF'}
                active={focusedKey === 'compactScorecards'}
                dots={2}
                activeDot={settings.compactScorecards ? 1 : 0}
                onFocus={() => setFocusedKey('compactScorecards')}
                onPrev={() => toggleBoolWithSfx('compactScorecards')}
                onNext={() => toggleBoolWithSfx('compactScorecards')}
              />
              <StepperRow
                label="Broadcast Animations"
                valueLabel={settings.showBroadcastAnimations ? 'ON' : 'OFF'}
                active={focusedKey === 'showBroadcastAnimations'}
                dots={2}
                activeDot={settings.showBroadcastAnimations ? 1 : 0}
                onFocus={() => setFocusedKey('showBroadcastAnimations')}
                onPrev={() => toggleBoolWithSfx('showBroadcastAnimations')}
                onNext={() => toggleBoolWithSfx('showBroadcastAnimations')}
              />
              <StepperRow
                label="High-Contrast Badges"
                valueLabel={settings.highContrastBadges ? 'ON' : 'OFF'}
                active={focusedKey === 'highContrastBadges'}
                dots={2}
                activeDot={settings.highContrastBadges ? 1 : 0}
                onFocus={() => setFocusedKey('highContrastBadges')}
                onPrev={() => toggleBoolWithSfx('highContrastBadges')}
                onNext={() => toggleBoolWithSfx('highContrastBadges')}
              />
            </div>
          )}

          {activeTab === 'Controls' && (
            <div className="space-y-1.5">
              <div className="px-4 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                INPUT &amp; SHORTCUTS
              </div>
              <StepperRow
                label="Keyboard Navigation"
                valueLabel={settings.keyboardShortcuts ? 'ON' : 'OFF'}
                active={focusedKey === 'keyboardShortcuts'}
                dots={2}
                activeDot={settings.keyboardShortcuts ? 1 : 0}
                onFocus={() => setFocusedKey('keyboardShortcuts')}
                onPrev={() => toggleBoolWithSfx('keyboardShortcuts')}
                onNext={() => toggleBoolWithSfx('keyboardShortcuts')}
              />
              <StepperRow
                label="Q / E Tab Stepping"
                valueLabel={settings.quickTabStepping ? 'ON' : 'OFF'}
                active={focusedKey === 'quickTabStepping'}
                dots={2}
                activeDot={settings.quickTabStepping ? 1 : 0}
                onFocus={() => setFocusedKey('quickTabStepping')}
                onPrev={() => toggleBoolWithSfx('quickTabStepping')}
                onNext={() => toggleBoolWithSfx('quickTabStepping')}
              />
            </div>
          )}
        </div>

        {/* Right 5 Columns: Focus Description + Full Interactive Music Deck */}
        <div className="lg:col-span-5 space-y-4">
          <div className="cm27-panel p-6 rounded-xl space-y-3 border-white/12">
            <h3 className="font-condensed text-2xl font-bold text-white uppercase tracking-wide">
              {activeMeta.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {activeMeta.description}
            </p>
          </div>

          {activeTab === 'Audio' && (
            <div className="cm27-panel p-5 rounded-xl space-y-4 border-[#93E6EE]/20">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#93E6EE]">
                    NOW PLAYING · SOUNDTRACK DECK
                  </div>
                  <div className="font-condensed text-2xl font-bold text-white uppercase truncate mt-0.5">
                    {currentTrack.title}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{currentTrack.artist}</div>
                </div>
                <button
                  type="button"
                  data-sfx="none"
                  onClick={() => toggleBoolWithSfx('muteMusic')}
                  className="p-2 rounded bg-white/[0.05] border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                  aria-label={settings.muteMusic ? 'Unmute Music' : 'Mute Music'}
                  title={settings.muteMusic ? 'Unmute Music' : 'Mute Music'}
                >
                  {settings.muteMusic || !settings.musicEnabled ? (
                    <VolumeX className="w-4 h-4 text-rose-300" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-[#93E6EE]" />
                  )}
                </button>
              </div>

              {/* Live Progress & Seek */}
              <div className="space-y-1.5">
                <input
                  type="range"
                  aria-label="Seek music timeline"
                  min={0}
                  max={Math.max(1, Math.floor(durationSec || 100))}
                  value={Math.floor(durationSec > 0 ? currentTimeSec : 0)}
                  onChange={(e) => seekMusic(Number(e.target.value))}
                  disabled={durationSec <= 0}
                  className="w-full accent-[#93E6EE] h-1.5 bg-white/15 rounded-full cursor-pointer disabled:opacity-50"
                />
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                  <span>{formatMediaTime(currentTimeSec)}</span>
                  <div className="h-1 flex-1 mx-3 rounded-full bg-white/[0.07] overflow-hidden">
                    <div
                      className="h-full bg-[#93E6EE] transition-all duration-150"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span>{durationSec > 0 ? formatMediaTime(durationSec) : '--:--'}</span>
                </div>
              </div>

              {/* Transport Controls */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  data-sfx="none"
                  onClick={() => {
                    toggleShuffle();
                    soundEngine.playToggle(!settings.shuffleMode);
                  }}
                  className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                    settings.shuffleMode
                      ? 'border-[#93E6EE]/50 bg-[#93E6EE]/10 text-[#93E6EE]'
                      : 'border-white/10 text-slate-400 hover:text-white'
                  }`}
                  aria-label="Toggle Shuffle"
                  title={`Shuffle: ${settings.shuffleMode ? 'On' : 'Off'}`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-sfx="confirm"
                    onClick={prevTrack}
                    className="p-2 rounded border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-white cursor-pointer"
                    aria-label="Previous Track"
                    title="Previous Track"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    data-sfx="none"
                    onClick={() => {
                      toggleRadio();
                      soundEngine.playToggle(!settings.radioPlaying);
                    }}
                    className="px-4 py-2 rounded cm27-btn-3d font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer"
                    aria-label={musicPlayback.isPlaying ? 'Pause Music' : 'Play Music'}
                  >
                    {musicPlayback.isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Play</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    data-sfx="confirm"
                    onClick={nextTrack}
                    className="p-2 rounded border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-white cursor-pointer"
                    aria-label="Next Track"
                    title="Next Track"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  data-sfx="click"
                  onClick={cycleRepeatMode}
                  className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                    settings.repeatMode !== 'off'
                      ? 'border-[#EAB308]/50 bg-[#EAB308]/10 text-[#EAB308]'
                      : 'border-white/10 text-slate-400 hover:text-white'
                  }`}
                  aria-label={`Repeat Mode: ${settings.repeatMode}`}
                  title={`Repeat: ${settings.repeatMode.toUpperCase()}`}
                >
                  {settings.repeatMode === 'one' ? (
                    <Repeat1 className="w-3.5 h-3.5" />
                  ) : (
                    <Repeat className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Track Quick Switcher (Strictly 2 uploaded MP3 tracks) */}
              <div className="space-y-1.5 pt-2 border-t border-white/[0.07]">
                {tracks.map((tr, idx) => {
                  const active = idx === settings.trackIndex % tracks.length;
                  return (
                    <button
                      key={tr.id}
                      type="button"
                      data-sfx="confirm"
                      onClick={() => selectTrack(idx)}
                      className={`w-full text-left px-3 py-2 rounded border text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        active
                          ? 'border-[#93E6EE]/55 bg-[#101B24] text-white font-semibold'
                          : 'border-white/[0.06] bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{tr.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">{tr.artist}</div>
                      </div>
                      <span className="text-[10px] font-mono text-[#93E6EE] shrink-0">
                        {active && musicPlayback.isPlaying ? 'PLAYING' : `${idx + 1}/${tracks.length}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {musicPlayback.loadError && (
                <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded px-3 py-2">
                  {musicPlayback.loadError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
