export type RepeatMode = 'off' | 'all' | 'one';

export function normalizeTrackIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((Math.trunc(index) % length) + length) % length;
}

export function stepTrackIndex(opts: {
  currentIndex: number;
  length: number;
  direction: 1 | -1;
  shuffleMode: boolean;
  randomFloat?: number;
}): number {
  const { currentIndex, length, direction, shuffleMode, randomFloat = Math.random() } = opts;
  if (length <= 1) return 0;
  const cur = normalizeTrackIndex(currentIndex, length);
  if (shuffleMode && length > 2) {
    const offset = 1 + Math.floor(Math.max(0, Math.min(0.999999, randomFloat)) * (length - 1));
    return (cur + offset) % length;
  }
  if (shuffleMode && length === 2) {
    return cur === 0 ? 1 : 0;
  }
  return (cur + direction + length) % length;
}

export function getTrackEndedResolution(opts: {
  currentIndex: number;
  length: number;
  repeatMode: RepeatMode;
  shuffleMode: boolean;
  randomFloat?: number;
}): { action: 'loop_one' | 'next' | 'stop'; nextIndex: number } {
  const { currentIndex, length, repeatMode, shuffleMode, randomFloat } = opts;
  const cur = normalizeTrackIndex(currentIndex, length);
  if (repeatMode === 'one') {
    return { action: 'loop_one', nextIndex: cur };
  }
  if (repeatMode === 'off') {
    if (!shuffleMode && cur >= length - 1) {
      return { action: 'stop', nextIndex: cur };
    }
    const nextIndex = stepTrackIndex({
      currentIndex: cur,
      length,
      direction: 1,
      shuffleMode,
      randomFloat,
    });
    return { action: 'next', nextIndex };
  }
  const nextIndex = stepTrackIndex({
    currentIndex: cur,
    length,
    direction: 1,
    shuffleMode,
    randomFloat,
  });
  return { action: 'next', nextIndex };
}

export function cycleRepeatModeValue(current: RepeatMode): RepeatMode {
  if (current === 'off') return 'all';
  if (current === 'all') return 'one';
  return 'off';
}

export function computeEffectiveMusicGain(opts: {
  musicEnabled: boolean;
  muteMusic: boolean;
  musicVolume: number;
}): number {
  if (!opts.musicEnabled || opts.muteMusic) return 0;
  const clamped = Math.max(0, Math.min(100, Number(opts.musicVolume) || 0));
  return Number((clamped / 100).toFixed(4));
}

export function computeEffectiveSfxGain(opts: {
  sfxEnabled: boolean;
  sfxVolume: number;
}): number {
  if (!opts.sfxEnabled) return 0;
  const clamped = Math.max(0, Math.min(100, Number(opts.sfxVolume) || 0));
  return Number((clamped / 100).toFixed(4));
}

export function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function stepClampedIndex(
  currentIdx: number,
  delta: number,
  length: number
): { nextIdx: number; moved: boolean } {
  if (length <= 0) return { nextIdx: 0, moved: false };
  const clampedCur = Math.max(0, Math.min(length - 1, Math.trunc(currentIdx)));
  const candidate = Math.max(0, Math.min(length - 1, clampedCur + Math.trunc(delta)));
  return {
    nextIdx: candidate,
    moved: candidate !== clampedCur,
  };
}

export class SfxRateLimiter {
  private lastPlayedAt = new Map<string, number>();

  public shouldPlay(channelKey: string, nowMs: number, minIntervalMs = 65): boolean {
    const prev = this.lastPlayedAt.get(channelKey);
    if (prev !== undefined && nowMs - prev < minIntervalMs) {
      return false;
    }
    this.lastPlayedAt.set(channelKey, nowMs);
    return true;
  }

  public reset() {
    this.lastPlayedAt.clear();
  }
}
