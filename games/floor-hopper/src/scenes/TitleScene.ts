import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { addHopperButton } from './ui';

export const FLOOR_HOPPER_TITLE_SCENE = 'floor-hopper:title';
export const FLOOR_HOPPER_GAME_SCENE = 'floor-hopper:game';

export class FloorHopperTitleScene extends Phaser.Scene {
  private runtime!: RuntimeActions;

  constructor() {
    super(FLOOR_HOPPER_TITLE_SCENE);
  }

  init(data: GameSceneData): void {
    this.runtime = data.runtime;
  }

  create(): void {
    playSharedBgm(this, 'title');
    this.cameras.main.setBackgroundColor(0x07141c);
    this.add.text(640, 120, 'FLOOR HOPPER', {
      fontFamily: 'Arial Black',
      fontSize: '54px',
      color: '#5eead4',
    }).setOrigin(0.5);
    this.add.text(640, 188, 'Ride morning to dawn. The latter half actually gets fast.', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#c5d6e2',
    }).setOrigin(0.5);
    this.add.text(640, 230, 'Jump: Space or click. After two jumps, hold Space to glide.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#7ef0d8',
    }).setOrigin(0.5);
    this.add.text(640, 268, 'Double jump once in the air to recover from gaps.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#8fb0c2',
    }).setOrigin(0.5);
    this.add.text(640, 306, 'Coins are 100 points. 10 coins grant an extra life.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffd166',
    }).setOrigin(0.5);
    this.add.text(640, 344, 'Two extra lives. Survive until dawn to CLEAR.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#c5d6e2',
    }).setOrigin(0.5);

    addHopperButton(this, 640, 430, 'Start', () => {
      this.scene.start(FLOOR_HOPPER_GAME_SCENE, { runtime: this.runtime });
    }, 260);

    addHopperButton(this, 500, 600, 'Launcher', () => this.runtime.returnToLauncher(), 220);
    if (this.runtime.canToggleFullscreen()) {
      addHopperButton(this, 780, 600, 'Fullscreen', () => void this.runtime.toggleFullscreen(), 220);
    }
  }
}
