import type Phaser from 'phaser';

export const SHARED_AUDIO = {
  uiClick: {
    key: 'shared:sfx:ui-click',
    url: new URL('../assets/audio/sfx/ui-click.wav', import.meta.url).href,
    volume: 0.32,
  },
  victory: {
    key: 'shared:sfx:victory',
    url: new URL('../assets/audio/sfx/victory-jingle.wav', import.meta.url).href,
    volume: 0.62,
  },
  defeat: {
    key: 'shared:sfx:defeat',
    url: new URL('../assets/audio/sfx/defeat-jingle.wav', import.meta.url).href,
    volume: 0.58,
  },
} as const;

export const SHARED_BGM = {
  title: {
    key: 'shared:bgm:title-selection',
    url: new URL('../assets/audio/bgm/title-selection.wav', import.meta.url).href,
    volume: 0.24,
  },
  thoughtful: {
    key: 'shared:bgm:thoughtful',
    url: new URL('../assets/audio/bgm/thoughtful.wav', import.meta.url).href,
    volume: 0.2,
  },
  active: {
    key: 'shared:bgm:active',
    url: new URL('../assets/audio/bgm/active.wav', import.meta.url).href,
    volume: 0.22,
  },
  upbeat: {
    key: 'shared:bgm:upbeat',
    url: new URL('../assets/audio/bgm/upbeat.wav', import.meta.url).href,
    volume: 0.2,
  },
} as const;

export type SharedBgmTrack = keyof typeof SHARED_BGM;

let activeBgmKey: string | undefined;
let activeBgm: Phaser.Sound.BaseSound | undefined;

export function preloadSharedAudio(scene: Phaser.Scene): void {
  for (const audio of [...Object.values(SHARED_AUDIO), ...Object.values(SHARED_BGM)]) {
    if (!scene.cache.audio.exists(audio.key)) scene.load.audio(audio.key, audio.url);
  }
}

export function playClickSound(scene: Phaser.Scene): void {
  const audio = SHARED_AUDIO.uiClick;
  if (scene.cache.audio.exists(audio.key)) scene.sound.play(audio.key, { volume: audio.volume });
}

export function playOutcomeSound(scene: Phaser.Scene, outcome: 'victory' | 'defeat'): void {
  const audio = SHARED_AUDIO[outcome];
  if (scene.cache.audio.exists(audio.key)) scene.sound.play(audio.key, { volume: audio.volume });
}

export function playSharedBgm(scene: Phaser.Scene, track: SharedBgmTrack): void {
  const audio = SHARED_BGM[track];
  if (!scene.cache.audio.exists(audio.key)) return;
  if (activeBgmKey === audio.key && activeBgm?.isPlaying) return;
  if (activeBgmKey === audio.key && activeBgm) {
    activeBgm.play();
    return;
  }
  activeBgm?.stop();
  activeBgm?.destroy();
  activeBgm = scene.sound.add(audio.key, { loop: true, volume: audio.volume });
  activeBgmKey = audio.key;
  activeBgm.play();
}
