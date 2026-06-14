import type { GameDefinition, RuntimeActions } from '@xinone/game-contracts';
import type Phaser from 'phaser';

export const BASE_WIDTH = 1280;
export const BASE_HEIGHT = 720;

export interface FullscreenAdapter {
  toggle(): Promise<void>;
}

export class GameRuntime implements RuntimeActions {
  private activeGame?: GameDefinition;
  private paused = false;

  constructor(
    private readonly game: Phaser.Game,
    private readonly launcherSceneKey: string,
    private readonly overlaySceneKey: string,
    private readonly fullscreenAdapter?: FullscreenAdapter,
  ) {}

  launch(definition: GameDefinition): void {
    this.stopActiveGame();
    this.activeGame = definition;
    this.paused = false;
    this.game.scene.stop(this.launcherSceneKey);
    this.game.scene.start(definition.startScene, { runtime: this });
    this.game.scene.start(this.overlaySceneKey, { runtime: this });
  }

  returnToLauncher(): void {
    this.stopActiveGame();
    this.game.scene.stop(this.overlaySceneKey);
    this.game.scene.start(this.launcherSceneKey);
  }

  togglePause(): boolean {
    if (!this.activeGame) return false;
    this.paused = !this.paused;
    for (const SceneClass of this.activeGame.scenes) {
      const key = new SceneClass().sys.settings.key;
      if (this.paused && this.game.scene.isActive(key)) this.game.scene.pause(key);
      else if (!this.paused && this.game.scene.isPaused(key)) this.game.scene.resume(key);
    }
    return this.paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  canToggleFullscreen(): boolean {
    return this.fullscreenAdapter !== undefined;
  }

  async toggleFullscreen(): Promise<void> {
    await this.fullscreenAdapter?.toggle();
  }

  private stopActiveGame(): void {
    if (!this.activeGame) return;
    for (const SceneClass of this.activeGame.scenes) {
      this.game.scene.stop(new SceneClass().sys.settings.key);
    }
    this.activeGame = undefined;
    this.paused = false;
  }
}
