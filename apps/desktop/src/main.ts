import { getCurrentWindow } from '@tauri-apps/api/window';
import { GameRuntime, BASE_HEIGHT, BASE_WIDTH, type FullscreenAdapter } from '@xinone/game-runtime';
import Phaser from 'phaser';
import { gameDefinitions } from './registry';
import { setRuntime } from './runtime-context';
import { LauncherScene, LAUNCHER_SCENE } from './scenes/LauncherScene';
import { SystemOverlayScene, SYSTEM_OVERLAY_SCENE } from './scenes/SystemOverlayScene';

class TauriFullscreenAdapter implements FullscreenAdapter {
  async toggle(): Promise<void> {
    const appWindow = getCurrentWindow();
    await appWindow.setFullscreen(!(await appWindow.isFullscreen()));
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
  scene: [LauncherScene, SystemOverlayScene, ...gameDefinitions.flatMap((definition) => definition.scenes)],
});

const fullscreenAdapter = '__TAURI_INTERNALS__' in window ? new TauriFullscreenAdapter() : undefined;
setRuntime(new GameRuntime(game, LAUNCHER_SCENE, SYSTEM_OVERLAY_SCENE, fullscreenAdapter));
