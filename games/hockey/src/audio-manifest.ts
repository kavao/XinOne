export const HOCKEY_AUDIO = {
  puckHit: {
    key: 'hockey:sfx:puck-hit',
    url: new URL('../assets/audio/sfx/puck-hit.wav', import.meta.url).href,
    volume: 0.38,
  },
  goal: {
    key: 'hockey:sfx:goal',
    url: new URL('../assets/audio/sfx/goal.wav', import.meta.url).href,
    volume: 0.68,
  },
  centerBoost: {
    key: 'hockey:sfx:center-boost',
    url: new URL('../assets/audio/sfx/center-boost.wav', import.meta.url).href,
    volume: 0.52,
  },
} as const;
