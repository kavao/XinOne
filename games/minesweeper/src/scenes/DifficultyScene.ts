import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { DIFFICULTIES, type Difficulty } from '../domain/board';
import { addButton } from './ui';

export const MINESWEEPER_DIFFICULTY_SCENE = 'minesweeper:difficulty';
export const MINESWEEPER_GAME_SCENE = 'minesweeper:game';

export class DifficultyScene extends Phaser.Scene {
  private runtime!: RuntimeActions;

  constructor() {
    super(MINESWEEPER_DIFFICULTY_SCENE);
  }

  init(data: GameSceneData): void {
    this.runtime = data.runtime;
  }

  create(): void {
    playSharedBgm(this, 'title');
    this.cameras.main.setBackgroundColor(0x0c1422);
    this.add.text(640, 115, 'MINESWEEPER', {
      fontFamily: 'Arial Black',
      fontSize: '58px',
      color: '#65d8ff',
    }).setOrigin(0.5);
    this.add.text(640, 180, 'Choose a difficulty', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#b8c7db',
    }).setOrigin(0.5);

    DIFFICULTIES.forEach((difficulty, index) => {
      addButton(this, 640, 280 + index * 82, this.labelFor(difficulty), () => {
        this.scene.start(MINESWEEPER_GAME_SCENE, { runtime: this.runtime, difficulty });
      }, 420);
    });

    addButton(this, 500, 590, 'Back to launcher', () => this.runtime.returnToLauncher(), 260);
    addButton(this, 780, 590, 'Fullscreen', () => void this.runtime.toggleFullscreen(), 220);
  }

  private labelFor(difficulty: Difficulty): string {
    return `${difficulty.label}  ${difficulty.width}x${difficulty.height} / ${difficulty.mines} mines`;
  }
}
