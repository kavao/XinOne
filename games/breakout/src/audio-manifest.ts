export const BREAKOUT_AUDIO = {
  ballHit: {
    key: 'breakout:sfx:ball-hit',
    url: new URL('../assets/audio/sfx/ball-hit.wav', import.meta.url).href,
    volume: 0.32,
  },
} as const;
