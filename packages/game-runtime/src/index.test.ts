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
    const scene = { start: vi.fn(), stop: vi.fn(), isActive: vi.fn(), isPaused: vi.fn() };
    const runtime = new GameRuntime({ scene } as never, 'app:launcher', 'app:overlay');

    runtime.launch(definition('one'));
    runtime.launch(definition('two'));
    runtime.returnToLauncher();

    expect(scene.start).toHaveBeenNthCalledWith(1, 'one:start', { runtime });
    expect(scene.start).toHaveBeenNthCalledWith(2, 'app:overlay', { runtime });
    expect(scene.start).toHaveBeenNthCalledWith(3, 'two:start', { runtime });
    expect(scene.start).toHaveBeenNthCalledWith(4, 'app:overlay', { runtime });
    expect(scene.start).toHaveBeenNthCalledWith(5, 'app:launcher');
    expect(scene.stop).toHaveBeenCalledWith('one:start');
    expect(scene.stop).toHaveBeenCalledWith('two:start');
    expect(scene.stop).toHaveBeenCalledWith('app:overlay');
  });

  it('uses the provided fullscreen adapter', async () => {
    const adapter = { toggle: vi.fn().mockResolvedValue(undefined) };
    const runtime = new GameRuntime({ scene: {} } as never, 'app:launcher', 'app:overlay', adapter);

    expect(runtime.canToggleFullscreen()).toBe(true);
    await runtime.toggleFullscreen();

    expect(adapter.toggle).toHaveBeenCalledOnce();
  });

  it('hides fullscreen controls when no native adapter is available', async () => {
    const runtime = new GameRuntime({ scene: {} } as never, 'app:launcher', 'app:overlay');

    expect(runtime.canToggleFullscreen()).toBe(false);
    await expect(runtime.toggleFullscreen()).resolves.toBeUndefined();
  });

  it('pauses and resumes every active scene owned by the launched game', () => {
    const scene = {
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      isActive: vi.fn().mockReturnValue(true),
      isPaused: vi.fn().mockReturnValue(true),
    };
    const runtime = new GameRuntime({ scene } as never, 'app:launcher', 'app:overlay');
    runtime.launch(definition('one'));

    expect(runtime.togglePause()).toBe(true);
    expect(runtime.isPaused()).toBe(true);
    expect(scene.pause).toHaveBeenCalledWith('one:start');

    expect(runtime.togglePause()).toBe(false);
    expect(runtime.isPaused()).toBe(false);
    expect(scene.resume).toHaveBeenCalledWith('one:start');
  });
});
