import type { GameDefinition, GameResult, GameScene } from '@xinone/game-contracts';
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

  it('records results and returns them in insertion order', () => {
    const runtime = new GameRuntime({ scene: {} } as never, 'app:launcher', 'app:overlay');
    const result: GameResult = {
      gameId: 'hockey',
      scoreType: 'score',
      value: 3,
      unit: '点',
      winCondition: 'higher',
      outcome: 'win',
      playedAt: '2026-06-19T05:30:00.000Z',
    };

    expect(runtime.getResults()).toHaveLength(0);
    runtime.recordResult(result);
    expect(runtime.getResults()).toHaveLength(1);
    expect(runtime.getResults()[0]).toEqual(result);

    const result2: GameResult = { ...result, gameId: 'minesweeper', value: 45 };
    runtime.recordResult(result2);
    expect(runtime.getResults()).toHaveLength(2);
    expect(runtime.getResults()[1].gameId).toBe('minesweeper');
  });

  it('restarts the active game from its title scene', () => {
    const scene = { start: vi.fn(), stop: vi.fn(), isActive: vi.fn(), isPaused: vi.fn() };
    const runtime = new GameRuntime({ scene } as never, 'app:launcher', 'app:overlay');
    runtime.launch(definition('one'));
    scene.start.mockClear();
    scene.stop.mockClear();

    runtime.returnToTitle();

    expect(scene.stop).toHaveBeenCalledWith('one:start');
    expect(scene.start).toHaveBeenCalledWith('one:start', { runtime });
    expect(scene.start).toHaveBeenCalledWith('app:overlay', { runtime });
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
