import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playClickSound, playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';

export const MECHA_SHOOTER_TITLE_SCENE = 'mecha-shooter:title';
export const MECHA_SHOOTER_GAME_SCENE = 'mecha-shooter:game';

export const MECHA_STAGES = [
  { id: 1, name: 'ORBITAL ELEVATOR' },
  { id: 2, name: 'DUST MINING BASE' },
] as const;

export class MechaShooterTitleScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  constructor() { super(MECHA_SHOOTER_TITLE_SCENE); }
  init(data: GameSceneData): void { this.runtime = data.runtime; }
  create(): void {
    playSharedBgm(this, 'title');
    this.cameras.main.setBackgroundColor(0x090e1b);
    this.add.text(640, 100, 'MECHA VANGUARD', { fontFamily: 'Arial Black', fontSize: '54px', color: '#ff8066' }).setOrigin(0.5);
    this.add.text(640, 164, 'A two-stage original mecha vertical shooter', { fontFamily: 'Arial', fontSize: '22px', color: '#cbd6ea' }).setOrigin(0.5);
    this.add.text(640, 202, 'Move: mouse   Auto-fire   Bomb: right click', { fontFamily: 'Arial', fontSize: '20px', color: '#8ed8ff' }).setOrigin(0.5);
    this.add.text(640, 248, 'After GAME OVER you can CONTINUE the current stage.', { fontFamily: 'Arial', fontSize: '18px', color: '#cbd6ea' }).setOrigin(0.5);
    this.button(640, 330, 'START', () => this.scene.start(MECHA_SHOOTER_GAME_SCENE, { runtime: this.runtime }), 260);
    this.add.text(640, 400, 'STAGE SELECT', { fontFamily: 'Arial Black', fontSize: '18px', color: '#ffd166' }).setOrigin(0.5);
    this.stageChip(470, 478, MECHA_STAGES[0]);
    this.stageChip(810, 478, MECHA_STAGES[1]);
    this.button(500, 640, 'LAUNCHER', () => this.runtime.returnToLauncher());
    if (this.runtime.canToggleFullscreen()) this.button(780, 640, 'FULLSCREEN', () => void this.runtime.toggleFullscreen());
  }
  private stageChip(x: number, y: number, stage: (typeof MECHA_STAGES)[number]): void {
    const background = this.add.rectangle(x, y, 300, 88, 0x18243d).setStrokeStyle(2, 0xff8066).setInteractive({ useHandCursor: true });
    this.add.text(x, y - 16, `STAGE ${stage.id}`, { fontFamily: 'Arial Black', fontSize: '22px', color: '#ff8066' }).setOrigin(0.5);
    this.add.text(x, y + 18, stage.name, { fontFamily: 'Arial', fontSize: '16px', color: '#cbd6ea' }).setOrigin(0.5);
    background.on('pointerover', () => background.setFillStyle(0x2b3b60));
    background.on('pointerout', () => background.setFillStyle(0x18243d));
    background.on('pointerdown', () => {
      playClickSound(this);
      this.scene.start(MECHA_SHOOTER_GAME_SCENE, { runtime: this.runtime, startStage: stage.id });
    });
  }
  private button(x: number, y: number, label: string, callback: () => void, width = 230): void {
    const bg = this.add.rectangle(x, y, width, 58, 0x18243d).setStrokeStyle(2, 0xff8066).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: 'Arial Black', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    bg.on('pointerdown', callback);
    bg.on('pointerover', () => bg.setFillStyle(0x2b3b60));
    bg.on('pointerout', () => bg.setFillStyle(0x18243d));
  }
}
