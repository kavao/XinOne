import type { GameDefinition } from '@xinone/game-contracts';
import { HockeyDifficultyScene, HOCKEY_DIFFICULTY_SCENE } from './scenes/DifficultyScene';
import { HockeyGameScene } from './scenes/GameScene';

export const hockeyDefinition: GameDefinition = {
  id: 'hockey',
  title: 'Spot Hockey',
  description: 'Outplay a three-level CPU and use the center boost spot.',
  accentColor: 0xff70d9,
  startScene: HOCKEY_DIFFICULTY_SCENE,
  scenes: [HockeyDifficultyScene, HockeyGameScene],
};

export * from './domain/hockey';
