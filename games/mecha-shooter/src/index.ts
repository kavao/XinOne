import type { GameDefinition } from '@xinone/game-contracts';
import { MechaShooterGameScene } from './scenes/GameScene';
import { MechaShooterTitleScene, MECHA_SHOOTER_TITLE_SCENE } from './scenes/TitleScene';

export const mechaShooterDefinition: GameDefinition = {
  id: 'mecha-shooter',
  title: 'Mecha Vanguard',
  description: 'Pilot an original combat mech through three vertical battles.',
  accentColor: 0xff6b5b,
  startScene: MECHA_SHOOTER_TITLE_SCENE,
  scenes: [MechaShooterTitleScene, MechaShooterGameScene],
};

export * from './domain/mecha-shooter';
