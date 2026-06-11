import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { CPU_DIFFICULTIES } from '../domain/hockey';
import { addHockeyButton } from './ui';

export const HOCKEY_DIFFICULTY_SCENE = 'hockey:difficulty';
export const HOCKEY_GAME_SCENE = 'hockey:game';

export class HockeyDifficultyScene extends Phaser.Scene {
  private runtime!: RuntimeActions;

  constructor() {
    super(HOCKEY_DIFFICULTY_SCENE);
  }

  init(data: GameSceneData): void {
    this.runtime = data.runtime;
  }

  create(): void {
    playSharedBgm(this, 'title');
    this.cameras.main.setBackgroundColor(0x130b25);
    this.add.text(640, 100, 'SPOT HOCKEY', {
      fontFamily: 'Arial Black',
      fontSize: '58px',
      color: '#ff70d9',
    }).setOrigin(0.5);
    this.add.text(640, 172, 'Move your paddle with the mouse. First to 5 wins.', {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#d7c6eb',
    }).setOrigin(0.5);
    this.add.text(640, 210, 'Hit the center spot to double the puck speed for 2 seconds.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffd166',
    }).setOrigin(0.5);

    CPU_DIFFICULTIES.forEach((difficulty, index) => {
      addHockeyButton(this, 640, 300 + index * 82, `${difficulty.label} CPU`, () => {
        this.scene.start(HOCKEY_GAME_SCENE, { runtime: this.runtime, difficulty });
      }, 330);
    });

    addHockeyButton(this, 500, 600, 'Back to launcher', () => this.runtime.returnToLauncher(), 260);
    addHockeyButton(this, 780, 600, 'Fullscreen', () => void this.runtime.toggleFullscreen(), 220);
  }
}
