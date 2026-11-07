import type { GameDefinition } from '@xinone/game-contracts';
import { FloorHopperGameScene } from './scenes/GameScene';
import { FloorHopperTitleScene, FLOOR_HOPPER_TITLE_SCENE } from './scenes/TitleScene';

export const floorHopperDefinition: GameDefinition = {
  id: 'floor-hopper',
  title: 'Floor Hopper',
  description: 'Jump across drifting floors. Space or click, with a double jump.',
  accentColor: 0x5eead4,
  startScene: FLOOR_HOPPER_TITLE_SCENE,
  scenes: [FloorHopperTitleScene, FloorHopperGameScene],
};

export * from './domain/floor-hopper';
