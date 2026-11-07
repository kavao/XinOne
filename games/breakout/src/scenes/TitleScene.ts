import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playClickSound, playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { STAGES } from '../domain/stages';
import { addBreakoutButton } from './ui';

export const BREAKOUT_TITLE_SCENE = 'breakout:title';
export const BREAKOUT_GAME_SCENE = 'breakout:game';

export class BreakoutTitleScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  private sliceEnabled = true;
  private sliceLabel?: Phaser.GameObjects.Text;
  private sliceBackground?: Phaser.GameObjects.Rectangle;

  constructor() {
    super(BREAKOUT_TITLE_SCENE);
  }

  init(data: GameSceneData): void {
    this.runtime = data.runtime;
  }

  create(): void {
    playSharedBgm(this, 'title');
    this.cameras.main.setBackgroundColor(0x0b1024);
    this.add.text(640, 88, 'COSMIC BREAKOUT', {
      fontFamily: 'Arial Black',
      fontSize: '54px',
      color: '#ffd166',
    }).setOrigin(0.5);
    this.add.text(640, 152, 'Move the paddle with the mouse. Clear all 5 stages.', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#d7c6eb',
    }).setOrigin(0.5);
    this.add.text(640, 186, 'Swipe the paddle to slice. Spin changes the next brick bounce.', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#9fd8ff',
    }).setOrigin(0.5);

    addBreakoutButton(this, 500, 268, 'Start', () => this.startGame(1), 220);
    this.addSliceToggle(790, 268);

    this.add.text(640, 340, 'STAGE SELECT', {
      fontFamily: 'Arial Black',
      fontSize: '18px',
      color: '#9fd8ff',
    }).setOrigin(0.5);

    const gap = 168;
    const startX = 640 - ((STAGES.length - 1) * gap) / 2;
    STAGES.forEach((stage, index) => {
      this.addStageChip(startX + index * gap, 430, stage.id, stage.title);
    });

    addBreakoutButton(this, 500, 600, 'Back to launcher', () => this.runtime.returnToLauncher(), 260);
    if (this.runtime.canToggleFullscreen()) {
      addBreakoutButton(this, 780, 600, 'Fullscreen', () => void this.runtime.toggleFullscreen(), 220);
    }
  }

  private addStageChip(x: number, y: number, stageNumber: number, title: string): void {
    const background = this.add.rectangle(x, y, 152, 86, 0x1c2440).setStrokeStyle(2, 0xffd166).setInteractive({ useHandCursor: true });
    this.add.text(x, y - 16, String(stageNumber), {
      fontFamily: 'Arial Black',
      fontSize: '28px',
      color: '#ffd166',
    }).setOrigin(0.5);
    this.add.text(x, y + 18, title, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#d7c6eb',
      align: 'center',
      wordWrap: { width: 136 },
    }).setOrigin(0.5);
    background.on('pointerover', () => background.setFillStyle(0x2f3a66));
    background.on('pointerout', () => background.setFillStyle(0x1c2440));
    background.on('pointerdown', () => {
      playClickSound(this);
      this.startGame(stageNumber);
    });
  }

  private addSliceToggle(x: number, y: number): void {
    this.sliceBackground = this.add.rectangle(x, y, 240, 54, 0x1c2440).setStrokeStyle(2, 0xff70d9).setInteractive({ useHandCursor: true });
    this.sliceLabel = this.add.text(x, y, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.refreshSliceToggle();
    this.sliceBackground.on('pointerover', () => this.sliceBackground?.setFillStyle(0x3a2450));
    this.sliceBackground.on('pointerout', () => this.sliceBackground?.setFillStyle(0x1c2440));
    this.sliceBackground.on('pointerdown', () => {
      playClickSound(this);
      this.sliceEnabled = !this.sliceEnabled;
      this.refreshSliceToggle();
    });
  }

  private refreshSliceToggle(): void {
    this.sliceLabel?.setText(this.sliceEnabled ? 'SLICE  ON' : 'SLICE  OFF');
    this.sliceBackground?.setStrokeStyle(2, this.sliceEnabled ? 0xff70d9 : 0x6b7390);
  }

  private startGame(stageNumber: number): void {
    this.scene.start(BREAKOUT_GAME_SCENE, {
      runtime: this.runtime,
      stageNumber,
      sliceEnabled: this.sliceEnabled,
    });
  }
}
