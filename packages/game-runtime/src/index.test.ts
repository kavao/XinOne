import type { GameDefinition, GameScene } from '@xinone/game-contracts';
import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from './index';

function definition(id: string): GameDefinition {
  const SceneClass = class {
    sys = { settings: { key: `${id}:start` } };
  } as unknown as GameScene;
  return {
    id,
    title: id,
    description: id,
    accentColor: 0,
    startScene: `${id}:start`,
    scenes: [SceneClass],
  };
}

describe('GameRuntime', () => {
  it('stops the active game before launching another one', () => {
    const scene = { start: vi.fn(), stop: vi.fn() };
    const runtime = new GameRuntime({ scene } as never, 'app:launcher');

    runtime.launch(definition('one'));
    runtime.launch(definition('two'));
    runtime.returnToLauncher();

    expect(scene.start).toHaveBeenNthCalledWith(1, 'one:start', { runtime });
    expect(scene.start).toHaveBeenNthCalledWith(2, 'two:start', { runtime });
    expect(scene.start).toHaveBeenNthCalledWith(3, 'app:launcher');
    expect(scene.stop).toHaveBeenCalledWith('one:start');
    expect(scene.stop).toHaveBeenCalledWith('two:start');
  });

  it('uses the provided fullscreen adapter', async () => {
    const adapter = { toggle: vi.fn().mockResolvedValue(undefined) };
    const runtime = new GameRuntime({ scene: {} } as never, 'app:launcher', adapter);

    await runtime.toggleFullscreen();

    expect(adapter.toggle).toHaveBeenCalledOnce();
  });
});
