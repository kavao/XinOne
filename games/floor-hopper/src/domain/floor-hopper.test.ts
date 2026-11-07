import { describe, expect, it } from 'vitest';
import { CLEAR_SECONDS, DAY_CYCLE, FloorHopperRun, WORLD, coinMaxHeight, isCoinReachable, scrollSpeedAt, skyPhaseAt } from './floor-hopper';

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

  it('glides after both jumps to slow a fall', () => {
    const falling = new FloorHopperRun(() => 0.5);
    const gliding = new FloorHopperRun(() => 0.5);
    for (const run of [falling, gliding]) {
      run.floors = [{ x: 0, y: 700, width: 800 }];
      run.playerY = 240;
      run.playerVy = 360;
      run.grounded = false;
      run.jumpsRemaining = 0;
    }
    gliding.setGlideHeld(true);

    for (let frame = 0; frame < 18; frame += 1) {
      falling.update(1 / 60);
      gliding.update(1 / 60);
    }

    expect(gliding.snapshot().gliding).toBe(true);
    expect(gliding.playerY).toBeLessThan(falling.playerY);
    expect(gliding.playerVy).toBeLessThanOrEqual(WORLD.glideFallCap);
    expect(falling.playerVy).toBeGreaterThan(WORLD.glideFallCap);
    expect(gliding.consumeEvents()).toContain('glide');
  });

  it('ramps slow to fast inside every 30-second sky phase, and the latter half is actually fast', () => {
    expect(scrollSpeedAt(1)).toBeCloseTo(DAY_CYCLE[0].slow, 0);
    expect(scrollSpeedAt(28)).toBeGreaterThan(scrollSpeedAt(8));
    expect(scrollSpeedAt(31)).toBeLessThan(scrollSpeedAt(28));
    expect(scrollSpeedAt(58)).toBeGreaterThan(scrollSpeedAt(32));
    expect(scrollSpeedAt(61)).toBeLessThan(scrollSpeedAt(58));
    expect(scrollSpeedAt(88)).toBeGreaterThan(scrollSpeedAt(62));
    expect(skyPhaseAt(5)).toBe('morning');
    expect(skyPhaseAt(35)).toBe('noon');
    expect(skyPhaseAt(65)).toBe('evening');
    expect(skyPhaseAt(95)).toBe('night');
    expect(skyPhaseAt(155)).toBe('dawn');
    expect(DAY_CYCLE[3].slow).toBeGreaterThan(DAY_CYCLE[1].fast);
    expect(DAY_CYCLE[5].fast).toBeGreaterThan(DAY_CYCLE[3].fast);
    expect(DAY_CYCLE[4].slow).toBeGreaterThan(DAY_CYCLE[2].fast);
  });

  it('clears after the dawn phase', () => {
    const run = new FloorHopperRun(() => 0.5);
    run.floors = [{ x: 0, y: WORLD.startFloorY, width: 1200 }];
    run.playerY = WORLD.startFloorY;
    run.playerVy = 0;
    run.grounded = true;
    run.runSeconds = CLEAR_SECONDS - 0.02;
    run.update(1 / 30);
    expect(run.status).toBe('cleared');
    expect(skyPhaseAt(run.runSeconds)).toBe('dawn');
    expect(run.score).toBe(Math.floor(run.distanceMeters) + run.coinCount * WORLD.coinPoints + WORLD.clearBonus);
    expect(run.consumeEvents()).toContain('clear');
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

  it('holds a downed hopper for respawn when extra lives remain', () => {
    const run = new FloorHopperRun(() => 0.5);
    run.floors = [];
    run.playerY = WORLD.fallLimit - 10;
    run.playerVy = 400;
    run.grounded = false;
    run.extraLives = 2;

    for (let frame = 0; frame < 20; frame += 1) run.update(1 / 60);

    expect(run.status).toBe('respawning');
    expect(run.extraLives).toBe(1);
    expect(run.playerY).toBe(WORLD.respawnHoldY);
    expect(run.consumeEvents()).toContain('downed');
  });

  it('drops in early from respawn and auto-drops after the hold time', () => {
    const run = new FloorHopperRun(() => 0.5);
    run.status = 'respawning';
    run.respawnSeconds = WORLD.respawnHoldSeconds;
    run.playerY = WORLD.respawnHoldY;

    expect(run.dropIn()).toBe(true);
    expect(run.status).toBe('playing');
    expect(run.consumeEvents()).toContain('drop-in');

    run.status = 'respawning';
    run.respawnSeconds = WORLD.respawnHoldSeconds;
    for (let frame = 0; frame < 160; frame += 1) run.update(1 / 60);
    expect(run.status).toBe('playing');
    expect(run.consumeEvents()).toContain('drop-in');
  });

  it('ends the run after falling with no extra lives left', () => {
    const run = new FloorHopperRun(() => 0.5);
    run.floors = [];
    run.playerY = WORLD.fallLimit - 10;
    run.playerVy = 400;
    run.grounded = false;
    run.extraLives = 0;

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

  it('scrolls coins at the same speed as floors', () => {
    const run = new FloorHopperRun(() => 0.5);
    run.floors = [{ x: 400, y: WORLD.startFloorY, width: 240 }];
    run.coins = [{ x: 500, y: WORLD.startFloorY - 70 }];
    const floorX = run.floors[0].x;
    const coinX = run.coins[0].x;

    run.update(1 / 60);

    expect(run.floors[0].x - floorX).toBeCloseTo(run.coins[0].x - coinX);
  });

  it('grants an extra life for every ten coins collected', () => {
    const run = new FloorHopperRun(() => 0.5);
    run.extraLives = 0;
    run.floors = [{ x: 0, y: WORLD.startFloorY, width: 600 }];
    run.playerY = WORLD.startFloorY;
    run.playerVy = 0;
    run.grounded = true;

    for (let taken = 0; taken < WORLD.coinsPerLife - 1; taken += 1) {
      run.coins = [{ x: WORLD.playerX, y: WORLD.startFloorY - WORLD.coinMinHeight }];
      run.update(1 / 60);
    }

    expect(run.coinCount).toBe(WORLD.coinsPerLife - 1);
    expect(run.extraLives).toBe(0);

    run.coins = [{ x: WORLD.playerX, y: WORLD.startFloorY - WORLD.coinMinHeight }];
    run.update(1 / 60);

    expect(run.coinCount).toBe(WORLD.coinsPerLife);
    expect(run.extraLives).toBe(1);
    expect(run.consumeEvents()).toContain('extra-life');

    run.coinCount = WORLD.coinsPerLife * 2 - 1;
    run.coins = [{ x: WORLD.playerX, y: WORLD.startFloorY - WORLD.coinMinHeight }];
    run.update(1 / 60);
    expect(run.extraLives).toBe(2);
  });

  it('adds coin points when the player touches a reachable coin', () => {
    const run = new FloorHopperRun(() => 0.5);
    run.floors = [{ x: 0, y: WORLD.startFloorY, width: 600 }];
    run.coins = [{ x: WORLD.playerX, y: WORLD.startFloorY - WORLD.coinMinHeight }];
    run.playerY = WORLD.startFloorY;
    run.playerVy = 0;
    const before = run.score;

    run.update(1 / 60);

    expect(run.coinCount).toBe(1);
    expect(run.score).toBeGreaterThanOrEqual(before + WORLD.coinPoints);
    expect(run.coins.some((coin) => Math.abs(coin.x - WORLD.playerX) < WORLD.coinRadius)).toBe(false);
    expect(run.consumeEvents()).toContain('coin');
  });

  it('only keeps spawned coins over floors inside the single-jump reach', () => {
    const run = new FloorHopperRun(() => 0.5);
    const maxHeight = coinMaxHeight();
    expect(run.coins.length).toBeGreaterThan(0);
    for (const coin of run.coins) {
      expect(isCoinReachable(coin, run.floors)).toBe(true);
      const floor = run.floors.find((candidate) => (
        coin.x >= candidate.x + WORLD.coinInset
        && coin.x <= candidate.x + candidate.width - WORLD.coinInset
      ));
      expect(floor).toBeDefined();
      if (!floor) continue;
      const height = floor.y - coin.y;
      expect(height).toBeGreaterThanOrEqual(WORLD.coinMinHeight);
      expect(height).toBeLessThanOrEqual(maxHeight);
    }
  });

  it('treats coins in gaps or above jump height as unreachable', () => {
    const floor = { x: 100, y: 500, width: 200 };
    expect(isCoinReachable({ x: 400, y: 430 }, [floor])).toBe(false);
    expect(isCoinReachable({ x: 180, y: 500 - coinMaxHeight() - 20 }, [floor])).toBe(false);
    expect(isCoinReachable({ x: 180, y: 500 - WORLD.coinMinHeight }, [floor])).toBe(true);
  });
});
