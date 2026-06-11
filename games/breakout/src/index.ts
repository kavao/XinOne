import type { GameDefinition } from '@xinone/game-contracts';
import { BreakoutGameScene } from './scenes/GameScene';
import { BreakoutTitleScene, BREAKOUT_TITLE_SCENE } from './scenes/TitleScene';

export const breakoutDefinition: GameDefinition = {
  id: 'breakout',
  title: 'Cosmic Breakout',
  description: 'Clear 5 stages of bricks across a space journey, with power-ups along the way.',
  accentColor: 0xffd166,
  startScene: BREAKOUT_TITLE_SCENE,
  scenes: [BreakoutTitleScene, BreakoutGameScene],
};

export * from './domain/breakout';
export * from './domain/stages';
