import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectiveMusicGain,
  computeEffectiveSfxGain,
  cycleRepeatModeValue,
  formatMediaTime,
  getTrackEndedResolution,
  SfxRateLimiter,
  stepClampedIndex,
  stepTrackIndex,
} from './audioLogic.ts';

test('stepTrackIndex cycles cleanly between the 2-track playlist with and without shuffle', () => {
  assert.equal(
    stepTrackIndex({ currentIndex: 0, length: 2, direction: 1, shuffleMode: false }),
    1
  );
  assert.equal(
    stepTrackIndex({ currentIndex: 1, length: 2, direction: 1, shuffleMode: false }),
    0
  );
  assert.equal(
    stepTrackIndex({ currentIndex: 0, length: 2, direction: -1, shuffleMode: false }),
    1
  );
  // With 2 tracks and shuffle enabled, always swaps to the other track rather than repeating same track
  assert.equal(
    stepTrackIndex({ currentIndex: 0, length: 2, direction: 1, shuffleMode: true }),
    1
  );
  assert.equal(
    stepTrackIndex({ currentIndex: 1, length: 2, direction: 1, shuffleMode: true }),
    0
  );
});

test('getTrackEndedResolution handles repeat modes off, all, and one accurately', () => {
  assert.deepEqual(
    getTrackEndedResolution({
      currentIndex: 0,
      length: 2,
      repeatMode: 'one',
      shuffleMode: false,
    }),
    { action: 'loop_one', nextIndex: 0 }
  );

  assert.deepEqual(
    getTrackEndedResolution({
      currentIndex: 0,
      length: 2,
      repeatMode: 'off',
      shuffleMode: false,
    }),
    { action: 'next', nextIndex: 1 }
  );

  assert.deepEqual(
    getTrackEndedResolution({
      currentIndex: 1,
      length: 2,
      repeatMode: 'off',
      shuffleMode: false,
    }),
    { action: 'stop', nextIndex: 1 }
  );

  assert.deepEqual(
    getTrackEndedResolution({
      currentIndex: 1,
      length: 2,
      repeatMode: 'all',
      shuffleMode: false,
    }),
    { action: 'next', nextIndex: 0 }
  );

  assert.equal(cycleRepeatModeValue('off'), 'all');
  assert.equal(cycleRepeatModeValue('all'), 'one');
  assert.equal(cycleRepeatModeValue('one'), 'off');
});

test('Music and UI SFX gain calculations are strictly independent', () => {
  assert.equal(
    computeEffectiveMusicGain({ musicEnabled: true, muteMusic: false, musicVolume: 65 }),
    0.65
  );
  assert.equal(
    computeEffectiveMusicGain({ musicEnabled: false, muteMusic: false, musicVolume: 80 }),
    0
  );
  assert.equal(
    computeEffectiveMusicGain({ musicEnabled: true, muteMusic: true, musicVolume: 80 }),
    0
  );

  assert.equal(computeEffectiveSfxGain({ sfxEnabled: true, sfxVolume: 70 }), 0.7);
  assert.equal(computeEffectiveSfxGain({ sfxEnabled: false, sfxVolume: 100 }), 0);
});

test('stepClampedIndex blocks movement and reports moved=false at top and bottom boundaries', () => {
  // At top boundary (0), moving -1 stays at 0 with moved=false (no wrap, no boundary SFX)
  assert.deepEqual(stepClampedIndex(0, -1, 5), { nextIdx: 0, moved: false });
  // Moving down from 0 -> 1 succeeds
  assert.deepEqual(stepClampedIndex(0, 1, 5), { nextIdx: 1, moved: true });
  // At bottom boundary (4), moving +1 stays at 4 with moved=false (no wrap, no boundary SFX)
  assert.deepEqual(stepClampedIndex(4, 1, 5), { nextIdx: 4, moved: false });
  // Empty list guard
  assert.deepEqual(stepClampedIndex(0, 1, 0), { nextIdx: 0, moved: false });
});

test('SfxRateLimiter enforces cooldown per channel without blocking other channels', () => {
  const limiter = new SfxRateLimiter();
  assert.equal(limiter.shouldPlay('nav_arrow', 1000, 65), true);
  assert.equal(limiter.shouldPlay('nav_arrow', 1030, 65), false);
  assert.equal(limiter.shouldPlay('nav_arrow', 1070, 65), true);
  assert.equal(limiter.shouldPlay('confirm', 1075, 65), true);
});

test('formatMediaTime formats elapsed and total seconds as m:ss', () => {
  assert.equal(formatMediaTime(0), '0:00');
  assert.equal(formatMediaTime(9), '0:09');
  assert.equal(formatMediaTime(195), '3:15');
  assert.equal(formatMediaTime(Number.NaN), '0:00');
});
