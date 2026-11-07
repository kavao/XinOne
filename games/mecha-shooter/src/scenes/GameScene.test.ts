import type { RuntimeActions } from '@xinone/game-contracts';
import { describe, expect, it, vi } from 'vitest';
import { MechaShooterMatch, type ShooterSnapshot } from '../domain/mecha-shooter';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('@xinone/shared-assets', () => ({ playClickSound: vi.fn(), playOutcomeSound: vi.fn(), playSharedBgm: vi.fn() }));

import { MechaShooterGameScene } from './GameScene';

interface SceneInternals {
  match: MechaShooterMatch;
  stage: number;
  bossDefeatCountdown: number;
  bossBurstTimer: number;
  render(snapshot: ShooterSnapshot): void;
  spawnImpactParticles(): void;
  spawnShockwave(): void;
  updateParticles(): void;
  updateShockwaves(): void;
}

function sceneAtBossDefeat(stage: number) {
  const runtime: RuntimeActions = {
    returnToLauncher: vi.fn(), togglePause: () => false, isPaused: () => false,
    canToggleFullscreen: () => false, toggleFullscreen: async () => {}, recordResult: vi.fn(),
  };
  const scene = new MechaShooterGameScene();
  scene.init({ runtime, startStage: stage } as Parameters<typeof scene.init>[0]);
  const internals = scene as unknown as SceneInternals;
  internals.match = new MechaShooterMatch(stage);
  internals.match.status = 'clear';
  internals.bossDefeatCountdown = 0.01;
  internals.bossBurstTimer = 1;
  // Only the renderer is stubbed; exercise the real scene transition/result handling.
  vi.spyOn(internals, 'render').mockImplementation(() => {});
  vi.spyOn(internals, 'spawnImpactParticles').mockImplementation(() => {});
  vi.spyOn(internals, 'spawnShockwave').mockImplementation(() => {});
  vi.spyOn(internals, 'updateParticles').mockImplementation(() => {});
  vi.spyOn(internals, 'updateShockwaves').mockImplementation(() => {});
  const widget = {
    setStrokeStyle: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(), setInteractive: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(),
  };
  const text = vi.fn((_x: number, _y: number, _label: string) => widget);
  Object.assign(scene, {
    add: { rectangle: () => widget, text },
    children: { getByName: () => undefined },
    cameras: { main: { flash: vi.fn(), shake: vi.fn() } },
    stageLabel: { setText: vi.fn() },
  });
  return { scene, internals, runtime, text };
}

describe('Mecha shooter boss defeat progression', () => {
  it('moves from Stage 1 into Stage 2 with the same score, lives and upgrades', () => {
    const { scene, internals, runtime } = sceneAtBossDefeat(1);
    Object.assign(internals.match, { score: 12345, lives: 2, bombCount: 1, powerLevel: 3, wideLevel: 1, shield: true });
    scene.update(0, 20);
    expect(internals.stage).toBe(2);
    expect(internals.match.stage).toBe(2);
    expect(internals.match.snapshot()).toMatchObject({ status: 'playing', score: 12345, lives: 2, bombCount: 1, powerLevel: 3, wideLevel: 1, shield: true });
    expect(runtime.recordResult).not.toHaveBeenCalled();
  });

  it('moves from Stage 2 into Stage 3 without prematurely recording victory', () => {
    const { scene, internals, runtime, text } = sceneAtBossDefeat(2);
    Object.assign(internals.match, { score: 24000, lives: 2, bombCount: 3, powerLevel: 3, wideLevel: 1, shield: true });
    scene.update(0, 20);
    expect(internals.stage).toBe(3);
    expect(internals.match.stage).toBe(3);
    expect(internals.match.snapshot()).toMatchObject({ status: 'playing', score: 24000, lives: 2, bombCount: 3, powerLevel: 3, wideLevel: 1, shield: true });
    expect(runtime.recordResult).not.toHaveBeenCalled();
    expect(text.mock.calls.some(([, , label]) => label === 'GAME CLEAR')).toBe(false);
  });

  it('shows GAME CLEAR after Stage 3 defeat effects and records victory exactly once', () => {
    const { scene, internals, runtime, text } = sceneAtBossDefeat(3);
    internals.match.score = 25000;
    scene.update(0, 20);
    expect(text.mock.calls.some(([, , label]) => label === 'GAME CLEAR')).toBe(true);
    expect(runtime.recordResult).toHaveBeenCalledExactlyOnceWith({
      gameId: 'mecha-shooter', scoreType: 'score', value: 25000, unit: '点',
      winCondition: 'higher', outcome: 'win', playedAt: expect.any(String),
    });
    scene.update(20, 20);
    expect(runtime.recordResult).toHaveBeenCalledTimes(1);
    expect(internals.stage).toBe(3);
  });
});
