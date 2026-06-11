import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { addBreakoutButton } from './ui';

export const BREAKOUT_TITLE_SCENE = 'breakout:title';
export const BREAKOUT_GAME_SCENE = 'breakout:game';

export class BreakoutTitleScene extends Phaser.Scene {
  private runtime!: RuntimeActions;

  constructor() {
    super(BREAKOUT_TITLE_SCENE);
  }

  init(data: GameSceneData): void {
    this.runtime = data.runtime;
  }

  create(): void {
    playSharedBgm(this, 'title');
    this.cameras.main.setBackgroundColor(0x0b1024);
    this.add.text(640, 110, 'COSMIC BREAKOUT', {
      fontFamily: 'Arial Black',
      fontSize: '54px',
      color: '#ffd166',
    }).setOrigin(0.5);
    this.add.text(640, 178, 'Move the paddle with the mouse. Clear all 5 stages.', {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#d7c6eb',
    }).setOrigin(0.5);
    this.add.text(640, 214, 'Stage 4 drops power-ups. Stage 5 is a giant gem to shatter.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#9fd8ff',
    }).setOrigin(0.5);

    addBreakoutButton(this, 640, 320, 'Start', () => {
      this.scene.start(BREAKOUT_GAME_SCENE, { runtime: this.runtime, stageNumber: 1 });
    }, 260);

    addBreakoutButton(this, 500, 600, 'Back to launcher', () => this.runtime.returnToLauncher(), 260);
    addBreakoutButton(this, 780, 600, 'Fullscreen', () => void this.runtime.toggleFullscreen(), 220);
  }
}
