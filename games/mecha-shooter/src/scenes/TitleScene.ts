import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';

export const MECHA_SHOOTER_TITLE_SCENE = 'mecha-shooter:title';
export const MECHA_SHOOTER_GAME_SCENE = 'mecha-shooter:game';

export class MechaShooterTitleScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  constructor() { super(MECHA_SHOOTER_TITLE_SCENE); }
  init(data: GameSceneData): void { this.runtime = data.runtime; }
  create(): void {
    playSharedBgm(this, 'title');
    this.cameras.main.setBackgroundColor(0x090e1b);
    this.add.text(640, 125, 'MECHA VANGUARD', { fontFamily: 'Arial Black', fontSize: '54px', color: '#ff8066' }).setOrigin(0.5);
    this.add.text(640, 195, 'A three-stage original mecha vertical shooter', { fontFamily: 'Arial', fontSize: '23px', color: '#cbd6ea' }).setOrigin(0.5);
    this.add.text(640, 260, 'Move: mouse   Auto-fire   Bomb: right click', { fontFamily: 'Arial', fontSize: '20px', color: '#8ed8ff' }).setOrigin(0.5);
    this.add.text(640, 325, 'TWO-STAGE BUILD — STAGE 1 + STAGE 2', { fontFamily: 'Arial Black', fontSize: '20px', color: '#ffd166' }).setOrigin(0.5);
    this.button(640, 430, 'START', () => this.scene.start(MECHA_SHOOTER_GAME_SCENE, { runtime: this.runtime }));
    this.button(500, 640, 'LAUNCHER', () => this.runtime.returnToLauncher());
    if (this.runtime.canToggleFullscreen()) this.button(780, 640, 'FULLSCREEN', () => void this.runtime.toggleFullscreen());
  }
  private button(x: number, y: number, label: string, callback: () => void): void {
    const bg = this.add.rectangle(x, y, 230, 58, 0x18243d).setStrokeStyle(2, 0xff8066).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: 'Arial Black', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    bg.on('pointerdown', callback);
    bg.on('pointerover', () => bg.setFillStyle(0x2b3b60));
    bg.on('pointerout', () => bg.setFillStyle(0x18243d));
  }
}
