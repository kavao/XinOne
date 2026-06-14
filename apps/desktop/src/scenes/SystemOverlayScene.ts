import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { pauseSharedBgm, playPauseSound, resumeSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';

export const SYSTEM_OVERLAY_SCENE = 'app:system-overlay';

export class SystemOverlayScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  private shade!: Phaser.GameObjects.Rectangle;
  private pausedText!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Text;

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
    this.pausedText = this.add.text(640, 360, 'PAUSED', {
      fontFamily: 'Arial Black',
      fontSize: '64px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(9999).setVisible(false);
    this.pauseButton = this.add.text(1272, 360, 'II', {
      fontFamily: 'Arial Black',
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#302451',
      padding: { x: 10, y: 12 },
    }).setOrigin(1, 0.5).setDepth(10000).setInteractive();
    this.pauseButton.on('pointerdown', () => this.togglePause());
  }

  update(): void {
    this.scene.bringToTop();
  }

  private togglePause(): void {
    playPauseSound(this);
    const paused = this.runtime.togglePause();
    if (paused) pauseSharedBgm();
    else resumeSharedBgm();
    this.shade.setVisible(paused);
    this.pausedText.setVisible(paused);
    this.pauseButton.setText(paused ? '>' : 'II');
  }
}
