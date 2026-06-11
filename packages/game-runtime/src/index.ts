import type { GameDefinition, RuntimeActions } from '@xinone/game-contracts';
import type Phaser from 'phaser';

export const BASE_WIDTH = 1280;
export const BASE_HEIGHT = 720;

export interface FullscreenAdapter {
  toggle(): Promise<void>;
}

export class GameRuntime implements RuntimeActions {
  private activeGame?: GameDefinition;

  constructor(
    private readonly game: Phaser.Game,
    private readonly launcherSceneKey: string,
    private readonly fullscreenAdapter?: FullscreenAdapter,
  ) {}

  launch(definition: GameDefinition): void {
    this.stopActiveGame();
    this.activeGame = definition;
    this.game.scene.stop(this.launcherSceneKey);
    this.game.scene.start(definition.startScene, { runtime: this });
  }

  returnToLauncher(): void {
    this.stopActiveGame();
    this.game.scene.start(this.launcherSceneKey);
  }

  async toggleFullscreen(): Promise<void> {
    if (this.fullscreenAdapter) {
      await this.fullscreenAdapter.toggle();
    } else if (this.game.scale.isFullscreen) {
      this.game.scale.stopFullscreen();
    } else {
      this.game.scale.startFullscreen();
    }
  }

  private stopActiveGame(): void {
    if (!this.activeGame) return;
    for (const SceneClass of this.activeGame.scenes) {
      this.game.scene.stop(new SceneClass().sys.settings.key);
    }
    this.activeGame = undefined;
  }
}
