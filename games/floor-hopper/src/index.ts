import type { GameDefinition } from '@xinone/game-contracts';
import { FloorHopperGameScene } from './scenes/GameScene';
import { FloorHopperTitleScene, FLOOR_HOPPER_TITLE_SCENE } from './scenes/TitleScene';

export const floorHopperDefinition: GameDefinition = {
  id: 'floor-hopper',
  title: 'Floor Hopper',
  description: 'Ride morning to dawn, glide after a double jump, and survive the fast night.',
  accentColor: 0x5eead4,
  startScene: FLOOR_HOPPER_TITLE_SCENE,
  scenes: [FloorHopperTitleScene, FloorHopperGameScene],
};

export * from './domain/floor-hopper';
