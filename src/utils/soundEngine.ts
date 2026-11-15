import {
  computeEffectiveMusicGain,
  computeEffectiveSfxGain,
  getTrackEndedResolution,
  normalizeTrackIndex,
  SfxRateLimiter,
  stepTrackIndex,
  type RepeatMode,
} from './audioLogic';

export interface MusicTrackInfo {
  id: string;
  title: string;
  artist: string;
  src: string;
}

export const CM27_MUSIC_TRACKS: MusicTrackInfo[] = [
  {
    id: 'love-me-again',
    title: 'Love Me Again',
    artist: 'John Newman',
    src: '/assets/aistudio/John_Newman_-_Love_Me_Again_1e30c4fc.mp3',
  },
  {
    id: 'feet-dont-fail-me-now',
    title: "Feet Don't Fail Me Now",
    artist: 'Joy Crookes',
    src: '/assets/aistudio/Joy_Crookes_-_Feet_Don_t_Fail_Me_Now__Official_Video__1d5540f7.mp3',
  },
];

export type SfxKey =
  | 'click'
  | 'tab_switch'
  | 'nav_arrow'
  | 'confirm'
  | 'menu_open'
  | 'menu_close'
  | 'dropdown'
  | 'toggle_on'
  | 'toggle_off'
  | 'select_player'
  | 'select_team'
  | 'success'
  | 'error'
  | 'warning'
  | 'match_event';

const SFX_FILES: Record<SfxKey, string> = {
  click: '/assets/sfx/click.wav',
  tab_switch: '/assets/sfx/tab_switch.wav',
  nav_arrow: '/assets/sfx/nav_arrow.wav',
  confirm: '/assets/sfx/confirm.wav',
  menu_open: '/assets/sfx/menu_open.wav',
  menu_close: '/assets/sfx/menu_close.wav',
  dropdown: '/assets/sfx/dropdown.wav',
  toggle_on: '/assets/sfx/toggle_on.wav',
  toggle_off: '/assets/sfx/toggle_off.wav',
  select_player: '/assets/sfx/select_player.wav',
  select_team: '/assets/sfx/select_team.wav',
  success: '/assets/sfx/success.wav',
  error: '/assets/sfx/error.wav',
  warning: '/assets/sfx/warning.wav',
  match_event: '/assets/sfx/match_event.wav',
};

export interface MusicPlaybackSnapshot {
  trackIndex: number;
  currentTrack: MusicTrackInfo;
  isPlaying: boolean;
  wantsPlay: boolean;
  currentTime: number;
  duration: number;
  loadError: string | null;
  autoplayBlocked: boolean;
}

type MusicListener = (snapshot: MusicPlaybackSnapshot) => void;

declare global {
  interface Window {
    __cm27SingletonSoundEngine?: CM27SoundEngine;
  }
}

class CM27SoundEngine {
  // Music singleton state (strictly decoupled from React component lifecycles)
  private musicAudio: HTMLAudioElement | null = null;
  private loadedTrackIndex = -1;
  private trackIndex = 0;
  private wantsPlay = true;
  private musicEnabled = true;
  private musicVolume = 50;
  private muteMusic = false;
  private shuffleMode = false;
  private repeatMode: RepeatMode = 'all';
  private duration = 0;
  private currentTime = 0;
  private loadError: string | null = null;
  private autoplayBlocked = false;
  private listeners = new Set<MusicListener>();
  private trackEndedListeners = new Set<(nextIdx: number, stopped: boolean) => void>();

  // SFX preloaded Web Audio + <audio> fallback state (strictly independent of Music channel)
  private sfxCtx: AudioContext | null = null;
  private sfxMasterGain: GainNode | null = null;
  private sfxBuffers = new Map<SfxKey, AudioBuffer>();
  private sfxLoading = new Map<SfxKey, Promise<AudioBuffer | null>>();
  private sfxFallbackPool = new Map<SfxKey, HTMLAudioElement>();
  private sfxEnabled = true;
  private sfxVolume = 75;
  private sfxPreloaded = false;
  private rateLimiter = new SfxRateLimiter();

  constructor() {
    if (typeof window !== 'undefined') {
      this.ensureMusicElement();
    }
  }

  private ensureMusicElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (this.musicAudio) return this.musicAudio;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.loop = false;
    audio.volume = computeEffectiveMusicGain({
      musicEnabled: this.musicEnabled,
      muteMusic: this.muteMusic,
      musicVolume: this.musicVolume,
    });

    audio.addEventListener('loadedmetadata', () => {
      this.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      this.loadError = null;
      this.emitMusicSnapshot();
    });

    audio.addEventListener('durationchange', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this.duration = audio.duration;
        this.emitMusicSnapshot();
      }
    });

    audio.addEventListener('timeupdate', () => {
      this.currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      this.emitMusicSnapshot();
    });

    audio.addEventListener('play', () => {
      this.autoplayBlocked = false;
      this.loadError = null;
      this.emitMusicSnapshot();
    });

    audio.addEventListener('pause', () => {
      this.emitMusicSnapshot();
    });

    audio.addEventListener('ended', () => {
      const resolution = getTrackEndedResolution({
        currentIndex: this.trackIndex,
        length: CM27_MUSIC_TRACKS.length,
        repeatMode: this.repeatMode,
        shuffleMode: this.shuffleMode,
      });

      if (resolution.action === 'loop_one') {
        audio.currentTime = 0;
        this.currentTime = 0;
        if (this.musicEnabled && this.wantsPlay) {
          void this.safePlayMusic();
        }
        this.emitMusicSnapshot();
        return;
      }

      if (resolution.action === 'stop') {
        this.wantsPlay = false;
        this.currentTime = 0;
        audio.currentTime = 0;
        this.trackEndedListeners.forEach((cb) => cb(this.trackIndex, true));
        this.emitMusicSnapshot();
        return;
      }

      this.loadAndPlayTrack(resolution.nextIndex, true);
      this.trackEndedListeners.forEach((cb) => cb(resolution.nextIndex, false));
    });

    audio.addEventListener('error', () => {
      const tr = CM27_MUSIC_TRACKS[this.trackIndex] || CM27_MUSIC_TRACKS[0];
      this.loadError = `Unable to stream "${tr.title}". Check network or try another track.`;
      this.emitMusicSnapshot();
    });

    this.musicAudio = audio;
    return audio;
  }

  private emitMusicSnapshot() {
    const snap = this.getMusicSnapshot();
    this.listeners.forEach((cb) => cb(snap));
  }

  public getMusicSnapshot(): MusicPlaybackSnapshot {
    const safeIdx = normalizeTrackIndex(this.trackIndex, CM27_MUSIC_TRACKS.length);
    const currentTrack = CM27_MUSIC_TRACKS[safeIdx] || CM27_MUSIC_TRACKS[0];
    const audio = this.musicAudio;
    const isPlaying = Boolean(
      audio && !audio.paused && !audio.ended && this.musicEnabled && this.wantsPlay
    );
    return {
      trackIndex: safeIdx,
      currentTrack,
      isPlaying,
      wantsPlay: this.wantsPlay,
      currentTime: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : this.currentTime,
      duration:
        audio && Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : this.duration,
      loadError: this.loadError,
      autoplayBlocked: this.autoplayBlocked,
    };
  }

  public subscribeMusic(listener: MusicListener): () => void {
    this.listeners.add(listener);
    listener(this.getMusicSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onTrackAutoAdvance(cb: (nextIdx: number, stopped: boolean) => void): () => void {
    this.trackEndedListeners.add(cb);
    return () => {
      this.trackEndedListeners.delete(cb);
    };
  }

  private loadTrackSource(index: number) {
    const audio = this.ensureMusicElement();
    if (!audio) return;
    const safeIdx = normalizeTrackIndex(index, CM27_MUSIC_TRACKS.length);
    const track = CM27_MUSIC_TRACKS[safeIdx] || CM27_MUSIC_TRACKS[0];
    this.trackIndex = safeIdx;

    if (this.loadedTrackIndex === safeIdx && audio.getAttribute('data-track-id') === track.id) {
      return;
    }

    this.loadedTrackIndex = safeIdx;
    this.duration = 0;
    this.currentTime = 0;
    this.loadError = null;
    audio.setAttribute('data-track-id', track.id);
    audio.src = track.src;
    audio.load();
    this.emitMusicSnapshot();
  }

  private async safePlayMusic(): Promise<boolean> {
    const audio = this.ensureMusicElement();
    if (!audio) return false;
    if (!this.musicEnabled) return false;

    if (this.loadedTrackIndex !== this.trackIndex) {
      this.loadTrackSource(this.trackIndex);
    }

    audio.volume = computeEffectiveMusicGain({
      musicEnabled: this.musicEnabled,
      muteMusic: this.muteMusic,
      musicVolume: this.musicVolume,
    });

    if (!audio.paused) {
      this.autoplayBlocked = false;
      return true;
    }

    try {
      await audio.play();
      this.autoplayBlocked = false;
      this.loadError = null;
      this.emitMusicSnapshot();
      return true;
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError') {
        this.autoplayBlocked = true;
      } else if (name !== 'AbortError') {
        this.loadError = 'Playback paused by browser audio policy. Click Play to resume.';
      }
      this.emitMusicSnapshot();
      return false;
    }
  }

  private loadAndPlayTrack(index: number, shouldPlay: boolean) {
    this.wantsPlay = shouldPlay;
    this.loadTrackSource(index);
    if (shouldPlay && this.musicEnabled) {
      void this.safePlayMusic();
    } else if (this.musicAudio && !this.musicAudio.paused) {
      this.musicAudio.pause();
    }
    this.emitMusicSnapshot();
  }

  public syncMusicConfig(opts: {
    musicEnabled: boolean;
    musicVolume: number;
    muteMusic: boolean;
    shuffleMode: boolean;
    repeatMode: RepeatMode;
    radioPlaying: boolean;
    trackIndex: number;
  }) {
    const prevTrack = this.trackIndex;
    const prevEnabled = this.musicEnabled;
    const prevWantsPlay = this.wantsPlay;

    this.musicEnabled = Boolean(opts.musicEnabled);
    this.musicVolume = Math.max(0, Math.min(100, Number(opts.musicVolume) || 0));
    this.muteMusic = Boolean(opts.muteMusic);
    this.shuffleMode = Boolean(opts.shuffleMode);
    this.repeatMode = opts.repeatMode;
    this.wantsPlay = Boolean(opts.radioPlaying);
    const nextIdx = normalizeTrackIndex(opts.trackIndex, CM27_MUSIC_TRACKS.length);
    this.trackIndex = nextIdx;

    const audio = this.ensureMusicElement();
    if (!audio) return;

    audio.volume = computeEffectiveMusicGain({
      musicEnabled: this.musicEnabled,
      muteMusic: this.muteMusic,
      musicVolume: this.musicVolume,
    });

    // Only reload if track index actually changed or audio wasn't initialized yet
    if (this.loadedTrackIndex === -1 || nextIdx !== prevTrack) {
      this.loadTrackSource(nextIdx);
    }

    if (!this.musicEnabled || !this.wantsPlay) {
      if (!audio.paused) {
        audio.pause();
      }
      if (prevEnabled !== this.musicEnabled || prevWantsPlay !== this.wantsPlay) {
        this.emitMusicSnapshot();
      }
      return;
    }

    if (audio.paused && (prevEnabled !== this.musicEnabled || prevWantsPlay !== this.wantsPlay || nextIdx !== prevTrack)) {
      void this.safePlayMusic();
    }
  }

  public syncSfxConfig(opts: { sfxEnabled: boolean; sfxVolume: number }) {
    this.sfxEnabled = Boolean(opts.sfxEnabled);
    this.sfxVolume = Math.max(0, Math.min(100, Number(opts.sfxVolume) || 0));
    if (this.sfxCtx && this.sfxMasterGain) {
      const gain = computeEffectiveSfxGain({
        sfxEnabled: this.sfxEnabled,
        sfxVolume: this.sfxVolume,
      });
      this.sfxMasterGain.gain.setTargetAtTime(gain, this.sfxCtx.currentTime, 0.015);
    }
  }

  public unlockAudioOnGesture() {
    // 1. Unlock Web Audio context for SFX
    this.ensureSfxContext();
    this.preloadAllSfx();

    // 2. Resume MP3 music ONLY if enabled, wantsPlay, and currently paused (never resets currentTime!)
    const audio = this.ensureMusicElement();
    if (audio && this.musicEnabled && this.wantsPlay && audio.paused) {
      void this.safePlayMusic();
    }
  }

  public playMusic() {
    this.wantsPlay = true;
    if (this.musicEnabled) {
      void this.safePlayMusic();
    }
    this.emitMusicSnapshot();
  }

  public pauseMusic() {
    this.wantsPlay = false;
    if (this.musicAudio && !this.musicAudio.paused) {
      this.musicAudio.pause();
    }
    this.emitMusicSnapshot();
  }

  public seekMusic(seconds: number) {
    const audio = this.ensureMusicElement();
    if (!audio) return;
    const maxDur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : this.duration;
    const clamped = Math.max(0, maxDur > 0 ? Math.min(maxDur, seconds) : seconds);
    try {
      audio.currentTime = clamped;
      this.currentTime = clamped;
      this.emitMusicSnapshot();
    } catch {
      // ignore seek before metadata
    }
  }

  public selectTrack(index: number, autoplay = true) {
    const safeIdx = normalizeTrackIndex(index, CM27_MUSIC_TRACKS.length);
    this.loadAndPlayTrack(safeIdx, autoplay);
  }

  public stepTrack(direction: 1 | -1): number {
    const nextIdx = stepTrackIndex({
      currentIndex: this.trackIndex,
      length: CM27_MUSIC_TRACKS.length,
      direction,
      shuffleMode: this.shuffleMode,
    });
    this.loadAndPlayTrack(nextIdx, true);
    return nextIdx;
  }

  // Backward-compatible shims
  public setVolumes(opts: {
    masterVolume?: number;
    uiVolume?: number;
    sfxVolume?: number;
    musicVolume: number;
    muteMaster?: boolean;
    muteMusic?: boolean;
    musicEnabled?: boolean;
    sfxEnabled?: boolean;
  }) {
    this.syncMusicConfig({
      musicEnabled: opts.musicEnabled ?? true,
      musicVolume: opts.musicVolume,
      muteMusic: opts.muteMusic ?? opts.muteMaster ?? false,
      shuffleMode: this.shuffleMode,
      repeatMode: this.repeatMode,
      radioPlaying: this.wantsPlay,
      trackIndex: this.trackIndex,
    });
    this.syncSfxConfig({
      sfxEnabled: opts.sfxEnabled ?? !(opts.muteMaster ?? false),
      sfxVolume: opts.sfxVolume ?? opts.uiVolume ?? 75,
    });
  }

  public setTrack(index: number) {
    const safeIdx = normalizeTrackIndex(index, CM27_MUSIC_TRACKS.length);
    if (safeIdx === this.loadedTrackIndex) return;
    this.loadAndPlayTrack(safeIdx, this.wantsPlay);
  }

  public startMusic(trackIdx?: number) {
    if (typeof trackIdx === 'number') {
      const safeIdx = normalizeTrackIndex(trackIdx, CM27_MUSIC_TRACKS.length);
      if (safeIdx !== this.loadedTrackIndex) {
        this.loadAndPlayTrack(safeIdx, true);
        return;
      }
    }
    this.playMusic();
  }

  public stopMusic() {
    this.pauseMusic();
  }

  // ===================== PRELOADED LOCAL WAV SFX ENGINE =====================

  private ensureSfxContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.sfxCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.sfxCtx = new AudioCtx();
        this.sfxMasterGain = this.sfxCtx.createGain();
        this.sfxMasterGain.gain.value = computeEffectiveSfxGain({
          sfxEnabled: this.sfxEnabled,
          sfxVolume: this.sfxVolume,
        });
        this.sfxMasterGain.connect(this.sfxCtx.destination);
      } catch {
        return null;
      }
    }
    if (this.sfxCtx.state === 'suspended') {
      void this.sfxCtx.resume().catch(() => {});
    }
    return this.sfxCtx;
  }

  public preloadAllSfx() {
    if (typeof window === 'undefined' || this.sfxPreloaded) return;
    this.sfxPreloaded = true;
    (Object.keys(SFX_FILES) as SfxKey[]).forEach((key) => {
      void this.preloadOneSfx(key);
    });
  }

  private async preloadOneSfx(key: SfxKey): Promise<AudioBuffer | null> {
    const existing = this.sfxBuffers.get(key);
    if (existing) return existing;

    const inFlight = this.sfxLoading.get(key);
    if (inFlight) return inFlight;

    const promise = (async () => {
      try {
        if (!this.sfxFallbackPool.has(key)) {
          const fallbackEl = new Audio(SFX_FILES[key]);
          fallbackEl.preload = 'auto';
          this.sfxFallbackPool.set(key, fallbackEl);
        }
        const ctx = this.ensureSfxContext();
        if (!ctx) return null;
        const resp = await fetch(SFX_FILES[key]);
        if (!resp.ok) return null;
        const arrBuf = await resp.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrBuf);
        this.sfxBuffers.set(key, decoded);
        return decoded;
      } catch {
        return null;
      } finally {
        this.sfxLoading.delete(key);
      }
    })();

    this.sfxLoading.set(key, promise);
    return promise;
  }

  public playSfx(key: SfxKey, minIntervalMs = 65) {
    if (typeof window === 'undefined') return;
    const gain = computeEffectiveSfxGain({
      sfxEnabled: this.sfxEnabled,
      sfxVolume: this.sfxVolume,
    });
    if (gain <= 0) return;

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!this.rateLimiter.shouldPlay(key, nowMs, minIntervalMs)) return;

    const ctx = this.ensureSfxContext();
    const buffer = this.sfxBuffers.get(key);

    if (ctx && this.sfxMasterGain && buffer) {
      try {
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.sfxMasterGain);
        source.start(0);
        return;
      } catch {
        // fall through to <audio> pool fallback
      }
    }

    // Trigger async decode for next press while playing preloaded <audio> clone immediately
    void this.preloadOneSfx(key);

    const baseAudio = this.sfxFallbackPool.get(key) || new Audio(SFX_FILES[key]);
    if (!this.sfxFallbackPool.has(key)) {
      baseAudio.preload = 'auto';
      this.sfxFallbackPool.set(key, baseAudio);
    }
    try {
      const instance = baseAudio.cloneNode(true) as HTMLAudioElement;
      instance.volume = gain;
      void instance.play().catch(() => {});
    } catch {
      // ignore playback restriction errors
    }
  }

  public playClick() {
    this.playSfx('click', 55);
  }

  public playTabSwitch() {
    this.playSfx('tab_switch', 65);
  }

  public playNav() {
    this.playTabSwitch();
  }

  public playNavArrow() {
    this.playSfx('nav_arrow', 65);
  }

  public playConfirm() {
    this.playSfx('confirm', 80);
  }

  public playMenuOpen() {
    this.playSfx('menu_open', 80);
  }

  public playMenuClose() {
    this.playSfx('menu_close', 80);
  }

  public playDropdown() {
    this.playSfx('dropdown', 65);
  }

  public playToggle(enabled: boolean) {
    this.playSfx(enabled ? 'toggle_on' : 'toggle_off', 65);
  }

  public playSelectPlayer() {
    this.playSfx('select_player', 65);
  }

  public playSelectTeam() {
    this.playSfx('select_team', 65);
  }

  public playSuccess() {
    this.playSfx('success', 100);
  }

  public playError() {
    this.playSfx('error', 100);
  }

  public playWarning() {
    this.playSfx('warning', 100);
  }

  public playMatchEvent() {
    this.playSfx('match_event', 140);
  }
}

function getSingletonSoundEngine(): CM27SoundEngine {
  if (typeof window !== 'undefined') {
    if (!window.__cm27SingletonSoundEngine) {
      window.__cm27SingletonSoundEngine = new CM27SoundEngine();
    }
    return window.__cm27SingletonSoundEngine;
  }
  return new CM27SoundEngine();
}

export const soundEngine = getSingletonSoundEngine();
