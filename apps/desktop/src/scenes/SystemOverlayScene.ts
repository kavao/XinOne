import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { pauseSharedBgm, playClickSound, playPauseSound, resumeSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';

export const SYSTEM_OVERLAY_SCENE = 'app:system-overlay';

export class SystemOverlayScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  private shade!: Phaser.GameObjects.Rectangle;
  private pausedText!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Text;
  private resumeButton!: Phaser.GameObjects.Rectangle;
  private titleButton!: Phaser.GameObjects.Rectangle;
  private launcherButton!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SYSTEM_OVERLAY_SCENE);
  }

  init(data: GameSceneData): void {
    this.runtime = data.runtime;
  }

  create(): void {
    this.shade = this.add.rectangle(640, 360, 1280, 720, 0x05030a, 0.72)
      .setDepth(9998)
      .setVisible(false);
    this.pausedText = this.add.text(640, 220, 'PAUSED', {
      fontFamily: 'Arial Black',
      fontSize: '64px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(9999).setVisible(false);
    this.resumeButton = this.addPauseMenuButton(640, 340, 'RESUME', () => this.togglePause());
    this.titleButton = this.addPauseMenuButton(640, 420, 'TITLE', () => this.leaveToTitle());
    this.launcherButton = this.addPauseMenuButton(640, 500, 'LAUNCHER', () => this.leaveToLauncher());
    this.pauseButton = this.add.text(1272, 360, 'II', {
      fontFamily: 'Arial Black',
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#302451',
      padding: { x: 10, y: 12 },
    }).setOrigin(1, 0.5).setDepth(10000).setInteractive();
    this.pauseButton.on('pointerdown', () => this.togglePause());
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
  }

  update(): void {
    this.scene.bringToTop();
  }

  private addPauseMenuButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Rectangle {
    const background = this.add.rectangle(x, y, 280, 58, 0x302451)
      .setStrokeStyle(2, 0xd7c6eb)
      .setDepth(10000)
      .setVisible(false);
    this.add.text(x, y, label, {
      fontFamily: 'Arial Black',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(10001).setVisible(false).setName(`${label}:label`);
    background.on('pointerover', () => background.setFillStyle(0x46366a));
    background.on('pointerout', () => background.setFillStyle(0x302451));
    background.on('pointerdown', onClick);
    return background;
  }

  private setMenuVisible(visible: boolean): void {
    this.shade.setVisible(visible);
    this.pausedText.setVisible(visible);
    for (const button of [this.resumeButton, this.titleButton, this.launcherButton]) {
      button.setVisible(visible);
      if (visible) button.setInteractive({ useHandCursor: true });
      else button.disableInteractive();
    }
    for (const label of ['RESUME', 'TITLE', 'LAUNCHER']) {
      const caption = this.children.getByName(`${label}:label`) as Phaser.GameObjects.Text | undefined;
      caption?.setVisible(visible);
    }
  }

  private togglePause(): void {
    playPauseSound(this);
    const paused = this.runtime.togglePause();
    if (paused) pauseSharedBgm();
    else resumeSharedBgm();
    this.setMenuVisible(paused);
    this.pauseButton.setText(paused ? '>' : 'II');
  }

  private leaveToTitle(): void {
    playClickSound(this);
    resumeSharedBgm();
    this.runtime.returnToTitle();
  }

  private leaveToLauncher(): void {
    playClickSound(this);
    resumeSharedBgm();
    this.runtime.returnToLauncher();
  }
}
