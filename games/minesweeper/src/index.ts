import type { GameDefinition } from '@xinone/game-contracts';
import { DifficultyScene, MINESWEEPER_DIFFICULTY_SCENE } from './scenes/DifficultyScene';
import { MinesweeperGameScene } from './scenes/GameScene';

export const minesweeperDefinition: GameDefinition = {
  id: 'minesweeper',
  title: 'Minesweeper',
  description: 'Clear a minefield using deduction, flags, and a steady mouse.',
  accentColor: 0x65d8ff,
  startScene: MINESWEEPER_DIFFICULTY_SCENE,
  scenes: [DifficultyScene, MinesweeperGameScene],
};

export * from './domain/board';
