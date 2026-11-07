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
    this.add.text(640, 188, 'Floors drift left. Stay on them as long as you can.', {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#c5d6e2',
    }).setOrigin(0.5);
    this.add.text(640, 236, 'Jump: Space or click', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#7ef0d8',
    }).setOrigin(0.5);
    this.add.text(640, 274, 'Double jump once in the air to recover from gaps.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#8fb0c2',
    }).setOrigin(0.5);

    addHopperButton(this, 640, 380, 'Start', () => {
      this.scene.start(FLOOR_HOPPER_GAME_SCENE, { runtime: this.runtime });
    }, 260);

    addHopperButton(this, 500, 600, 'Launcher', () => this.runtime.returnToLauncher(), 220);
    if (this.runtime.canToggleFullscreen()) {
      addHopperButton(this, 780, 600, 'Fullscreen', () => void this.runtime.toggleFullscreen(), 220);
    }
  }
}
