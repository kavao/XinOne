import { describe, expect, it } from 'vitest';
import { FloorHopperRun, WORLD } from './floor-hopper';

function settleOnStartFloor(run: FloorHopperRun): void {
  run.update(1 / 60);
}

describe('FloorHopperRun', () => {
  it('allows a grounded jump and then one air jump', () => {
    const run = new FloorHopperRun(() => 0.5);
    settleOnStartFloor(run);

    expect(run.jump()).toBe(true);
    expect(run.grounded).toBe(false);
    expect(run.jumpsRemaining).toBe(1);
    expect(run.playerVy).toBeLessThan(0);
    expect(run.consumeEvents()).toContain('jump');

    expect(run.jump()).toBe(true);
    expect(run.jumpsRemaining).toBe(0);
    expect(run.consumeEvents()).toContain('double-jump');
  });

  it('rejects a third jump before landing', () => {
    const run = new FloorHopperRun(() => 0.5);
    settleOnStartFloor(run);
    run.jump();
    run.jump();

    expect(run.jump()).toBe(false);
    expect(run.jumpsRemaining).toBe(0);
  });

  it('lands on a floor top and restores both jumps', () => {
    const run = new FloorHopperRun(() => 0.5);
    run.floors = [{ x: 0, y: 400, width: 600 }];
    run.playerY = 398;
    run.playerVy = 200;
    run.grounded = false;
    run.jumpsRemaining = 0;

    run.update(1 / 60);

    expect(run.grounded).toBe(true);
    expect(run.playerY).toBe(400);
    expect(run.playerVy).toBe(0);
    expect(run.jumpsRemaining).toBe(WORLD.maxJumps);
    expect(run.consumeEvents()).toContain('land');
  });

  it('still allows one air jump after walking off a floor', () => {
    const run = new FloorHopperRun(() => 0.5);
    run.floors = [{ x: 0, y: WORLD.startFloorY, width: WORLD.playerX }];
    run.playerY = WORLD.startFloorY;
    run.playerVy = 0;
    run.grounded = true;
    run.jumpsRemaining = WORLD.maxJumps;

    while (run.grounded && run.status === 'playing') run.update(1 / 60);

    expect(run.status).toBe('playing');
    expect(run.grounded).toBe(false);
    expect(run.jumpsRemaining).toBe(1);
    expect(run.jump()).toBe(true);
    expect(run.consumeEvents()).toContain('double-jump');
  });

  it('ends the run after falling below the screen', () => {
    const run = new FloorHopperRun(() => 0.5);
    run.floors = [];
    run.playerY = WORLD.fallLimit - 10;
    run.playerVy = 400;
    run.grounded = false;

    for (let frame = 0; frame < 20; frame += 1) run.update(1 / 60);

    expect(run.status).toBe('game-over');
    expect(run.consumeEvents()).toContain('game-over');
  });

  it('increases distance as floors scroll', () => {
    const run = new FloorHopperRun(() => 0.5);
    const before = run.distanceMeters;
    for (let frame = 0; frame < 30; frame += 1) run.update(1 / 60);
    expect(run.distanceMeters).toBeGreaterThan(before);
  });
});
