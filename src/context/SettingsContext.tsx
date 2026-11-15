import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  CM27_MUSIC_TRACKS,
  soundEngine,
  type MusicPlaybackSnapshot,
  type MusicTrackInfo,
} from '../utils/soundEngine';
import {
  cycleRepeatModeValue,
  normalizeTrackIndex,
  type RepeatMode,
} from '../utils/audioLogic';

export interface GameSettingsState {
  // Background Music (strictly independent from UI SFX)
  musicEnabled: boolean;
  musicVolume: number;
  muteMusic: boolean;
  shuffleMode: boolean;
  repeatMode: RepeatMode;
  radioPlaying: boolean;
  trackIndex: number;
  // UI Sound Effects (strictly independent from Music)
  sfxEnabled: boolean;
  sfxVolume: number;
  // Gameplay
  autoSaveDaily: boolean;
  confirmTacticalChanges: boolean;
  matchCommentaryAudioCues: boolean;
  // Display
  compactScorecards: boolean;
  showBroadcastAnimations: boolean;
  highContrastBadges: boolean;
  // Controls
  keyboardShortcuts: boolean;
  quickTabStepping: boolean;
}

const DEFAULT_SETTINGS: GameSettingsState = {
  musicEnabled: true,
  musicVolume: 50,
  muteMusic: false,
  shuffleMode: false,
  repeatMode: 'all',
  radioPlaying: true,
  trackIndex: 0,
  sfxEnabled: true,
  sfxVolume: 75,
  autoSaveDaily: true,
  confirmTacticalChanges: true,
  matchCommentaryAudioCues: true,
  compactScorecards: false,
  showBroadcastAnimations: true,
  highContrastBadges: true,
  keyboardShortcuts: true,
  quickTabStepping: true,
};

const STORAGE_KEY_V2 = 'cm27_game_settings_v2';
const STORAGE_KEY_V1 = 'cm27_game_settings_v1';

function loadInitialSettings(): GameSettingsState {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      const safeIdx = normalizeTrackIndex(
        Number(parsed.trackIndex) || 0,
        CM27_MUSIC_TRACKS.length
      );
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        trackIndex: safeIdx,
      };
    }

    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const p = JSON.parse(rawV1);
      return {
        ...DEFAULT_SETTINGS,
        musicVolume: Number.isFinite(p.musicVolume) ? p.musicVolume : DEFAULT_SETTINGS.musicVolume,
        sfxVolume: Number.isFinite(p.uiVolume) ? p.uiVolume : DEFAULT_SETTINGS.sfxVolume,
        muteMusic: Boolean(p.muteMaster),
        sfxEnabled: !Boolean(p.muteMaster),
        shuffleMode: Boolean(p.shuffleMode),
        radioPlaying: p.radioPlaying !== undefined ? Boolean(p.radioPlaying) : true,
        trackIndex: normalizeTrackIndex(Number(p.trackIndex) || 0, CM27_MUSIC_TRACKS.length),
        autoSaveDaily: p.autoSaveDaily ?? DEFAULT_SETTINGS.autoSaveDaily,
        confirmTacticalChanges: p.confirmTacticalChanges ?? DEFAULT_SETTINGS.confirmTacticalChanges,
        matchCommentaryAudioCues:
          p.matchCommentaryAudioCues ?? DEFAULT_SETTINGS.matchCommentaryAudioCues,
        compactScorecards: p.compactScorecards ?? DEFAULT_SETTINGS.compactScorecards,
        showBroadcastAnimations: p.showBroadcastAnimations ?? DEFAULT_SETTINGS.showBroadcastAnimations,
        highContrastBadges: p.highContrastBadges ?? DEFAULT_SETTINGS.highContrastBadges,
        keyboardShortcuts: p.keyboardShortcuts ?? DEFAULT_SETTINGS.keyboardShortcuts,
        quickTabStepping: p.quickTabStepping ?? DEFAULT_SETTINGS.quickTabStepping,
      };
    }
  } catch {
    // ignore storage read failure
  }
  return DEFAULT_SETTINGS;
}

interface SettingsContextValue {
  settings: GameSettingsState;
  currentTrack: MusicTrackInfo;
  tracks: MusicTrackInfo[];
  musicPlayback: MusicPlaybackSnapshot;
  updateSetting: <K extends keyof GameSettingsState>(key: K, value: GameSettingsState[K]) => void;
  toggleRadio: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  selectTrack: (index: number) => void;
  seekMusic: (seconds: number) => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
  resetDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<GameSettingsState>(() => loadInitialSettings());
  const [musicPlayback, setMusicPlayback] = useState<MusicPlaybackSnapshot>(() =>
    soundEngine.getMusicSnapshot()
  );

  // Sync music & SFX engines cleanly without ever interrupting live track playback
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(settings));
    } catch {
      // ignore storage quota errors
    }

    soundEngine.syncMusicConfig({
      musicEnabled: settings.musicEnabled,
      musicVolume: settings.musicVolume,
      muteMusic: settings.muteMusic,
      shuffleMode: settings.shuffleMode,
      repeatMode: settings.repeatMode,
      radioPlaying: settings.radioPlaying,
      trackIndex: settings.trackIndex,
    });

    soundEngine.syncSfxConfig({
      sfxEnabled: settings.sfxEnabled,
      sfxVolume: settings.sfxVolume,
    });
  }, [settings]);

  // Subscribe to persistent singleton music player events & auto-advance callbacks
  useEffect(() => {
    soundEngine.preloadAllSfx();
    const unsubMusic = soundEngine.subscribeMusic((snap) => {
      setMusicPlayback(snap);
    });
    const unsubEnd = soundEngine.onTrackAutoAdvance((nextIdx, stopped) => {
      setSettings((prev) => ({
        ...prev,
        trackIndex: nextIdx,
        radioPlaying: stopped ? false : prev.radioPlaying,
      }));
    });
    return () => {
      unsubMusic();
      unsubEnd();
    };
  }, []);

  // Global semantic pointer SFX + one-time autoplay audio unlock (never restarts active track!)
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      soundEngine.unlockAudioOnGesture();
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const sfxHost = target.closest('[data-sfx]') as HTMLElement | null;
      if (sfxHost) {
        const cue = sfxHost.getAttribute('data-sfx');
        if (cue === 'none') return;
        if (cue === 'tab') {
          soundEngine.playTabSwitch();
          return;
        }
        if (cue === 'confirm') {
          soundEngine.playConfirm();
          return;
        }
        if (cue === 'menu-open') {
          soundEngine.playMenuOpen();
          return;
        }
        if (cue === 'menu-close') {
          soundEngine.playMenuClose();
          return;
        }
        if (cue === 'dropdown') {
          soundEngine.playDropdown();
          return;
        }
        if (cue === 'select-player') {
          soundEngine.playSelectPlayer();
          return;
        }
        if (cue === 'select-team') {
          soundEngine.playSelectTeam();
          return;
        }
      }

      const control = target.closest(
        'button, [role="button"], a, select, input[type="checkbox"]'
      ) as HTMLElement | null;
      if (!control) return;

      if (control.tagName === 'SELECT') {
        soundEngine.playDropdown();
        return;
      }

      if (control instanceof HTMLInputElement && control.type === 'checkbox') {
        soundEngine.playToggle(!control.checked);
        return;
      }

      soundEngine.playClick();
    };

    const onKeyDown = () => {
      soundEngine.unlockAudioOnGesture();
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKeyDown, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const updateSetting = useCallback(
    <K extends keyof GameSettingsState>(key: K, value: GameSettingsState[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleRadio = useCallback(() => {
    setSettings((prev) => {
      const nextPlaying = !prev.radioPlaying;
      if (nextPlaying) {
        soundEngine.playMusic();
      } else {
        soundEngine.pauseMusic();
      }
      return {
        ...prev,
        musicEnabled: nextPlaying ? true : prev.musicEnabled,
        radioPlaying: nextPlaying,
      };
    });
  }, []);

  const nextTrack = useCallback(() => {
    const nextIdx = soundEngine.stepTrack(1);
    setSettings((prev) => ({
      ...prev,
      musicEnabled: true,
      trackIndex: nextIdx,
      radioPlaying: true,
    }));
  }, []);

  const prevTrack = useCallback(() => {
    const prevIdx = soundEngine.stepTrack(-1);
    setSettings((prev) => ({
      ...prev,
      musicEnabled: true,
      trackIndex: prevIdx,
      radioPlaying: true,
    }));
  }, []);

  const selectTrack = useCallback((index: number) => {
    const safeIdx = normalizeTrackIndex(index, CM27_MUSIC_TRACKS.length);
    soundEngine.selectTrack(safeIdx, true);
    setSettings((prev) => ({
      ...prev,
      musicEnabled: true,
      trackIndex: safeIdx,
      radioPlaying: true,
    }));
  }, []);

  const seekMusic = useCallback((seconds: number) => {
    soundEngine.seekMusic(seconds);
  }, []);

  const cycleRepeatMode = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      repeatMode: cycleRepeatModeValue(prev.repeatMode),
    }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      shuffleMode: !prev.shuffleMode,
    }));
  }, []);

  const resetDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const currentTrack =
    CM27_MUSIC_TRACKS[normalizeTrackIndex(settings.trackIndex, CM27_MUSIC_TRACKS.length)] ||
    CM27_MUSIC_TRACKS[0];

  return (
    <SettingsContext.Provider
      value={{
        settings,
        currentTrack,
        tracks: CM27_MUSIC_TRACKS,
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
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return ctx;
}
