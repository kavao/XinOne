import { getCurrentWindow } from '@tauri-apps/api/window';
import { GameRuntime, BASE_HEIGHT, BASE_WIDTH, type FullscreenAdapter } from '@xinone/game-runtime';
import Phaser from 'phaser';
import { gameDefinitions } from './registry';
import { setRuntime } from './runtime-context';
import { LauncherScene, LAUNCHER_SCENE } from './scenes/LauncherScene';

class TauriFullscreenAdapter implements FullscreenAdapter {
  async toggle(): Promise<void> {
    if ('__TAURI_INTERNALS__' in window) {
      const appWindow = getCurrentWindow();
      await appWindow.setFullscreen(!(await appWindow.isFullscreen()));
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#08111f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_WIDTH,
    height: BASE_HEIGHT,
  },
  scene: [LauncherScene, ...gameDefinitions.flatMap((definition) => definition.scenes)],
});

setRuntime(new GameRuntime(game, LAUNCHER_SCENE, new TauriFullscreenAdapter()));
