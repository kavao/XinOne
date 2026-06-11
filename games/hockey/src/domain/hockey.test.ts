import { describe, expect, it } from 'vitest';
import { CPU_DIFFICULTIES, HockeyMatch, RINK } from './hockey';

describe('HockeyMatch', () => {
  it('keeps the player paddle inside the left half of the rink', () => {
    const match = new HockeyMatch(CPU_DIFFICULTIES[1]);
    match.update(1 / 60, { x: -100, y: -100 });

    expect(match.player.x).toBe(RINK.left + RINK.paddleRadius);
    expect(match.player.y).toBe(RINK.top + RINK.paddleRadius);
  });

  it('starts both paddles on their goal-side lines', () => {
    const match = new HockeyMatch(CPU_DIFFICULTIES[1]);

    expect(match.player).toEqual({ x: RINK.playerStartX, y: RINK.centerY });
    expect(match.cpu).toEqual({ x: RINK.cpuStartX, y: RINK.centerY });
  });

  it('moves harder CPU paddles farther during the same update', () => {
    const easy = new HockeyMatch(CPU_DIFFICULTIES[0]);
    const hard = new HockeyMatch(CPU_DIFFICULTIES[2]);
    easy.puck.x = hard.puck.x = RINK.right - 100;
    easy.puck.y = hard.puck.y = RINK.top + 100;

    easy.update(0.1, easy.player);
    hard.update(0.1, hard.player);

    expect(Math.abs(hard.cpu.y - RINK.centerY)).toBeGreaterThan(Math.abs(easy.cpu.y - RINK.centerY));
  });

  it('doubles puck speed for only two seconds after entering the center spot', () => {
    const match = new HockeyMatch(CPU_DIFFICULTIES[1]);
    match.puck.x = RINK.left + 100;
    match.puck.y = RINK.centerY;
    match.puckVelocity.x = 0;
    match.puckVelocity.y = 0;
    match.update(1 / 60, match.player);

    match.puck.x = RINK.centerX;
    match.puck.y = RINK.centerY - RINK.spotRadius - RINK.puckRadius - 1;
    match.puckVelocity.x = 0;
    match.puckVelocity.y = 100;

    match.update(1 / 60, match.player);
    const boostedSpeed = Math.hypot(match.puckVelocity.x, match.puckVelocity.y);
    expect(match.consumeEvents()).toContain('center-boost');
    for (let frame = 0; frame < 119; frame += 1) {
      match.update(1 / 60, match.player);
    }

    expect(boostedSpeed).toBeCloseTo(200);
    expect(Math.hypot(match.puckVelocity.x, match.puckVelocity.y)).toBeCloseTo(200);
    expect(match.boostRemaining).toBeGreaterThan(0);

    match.update(1 / 60, match.player);

    expect(match.boostRemaining).toBe(0);
    expect(Math.hypot(match.puckVelocity.x, match.puckVelocity.y)).toBeCloseTo(100);
  });

  it('awards a goal when the puck crosses inside the goal mouth', () => {
    const match = new HockeyMatch(CPU_DIFFICULTIES[1]);
    match.puck.x = RINK.right - RINK.puckRadius - 1;
    match.puck.y = RINK.centerY;
    match.puckVelocity.x = 500;
    match.puckVelocity.y = 0;

    match.update(0.1, match.player);

    expect(match.playerScore).toBe(1);
    expect(match.puck.x).toBe(RINK.centerX);
    expect(match.puck.y).toBe(RINK.centerY);
    expect(match.player).toEqual({ x: RINK.playerStartX, y: RINK.centerY });
    expect(match.cpu).toEqual({ x: RINK.cpuStartX, y: RINK.centerY });
    expect(match.consumeEvents()).toEqual(['goal']);
    expect(match.consumeEvents()).toEqual([]);
  });

  it('bounces off the right wall outside the goal mouth', () => {
    const match = new HockeyMatch(CPU_DIFFICULTIES[1]);
    match.puck.x = RINK.right - RINK.puckRadius - 1;
    match.puck.y = RINK.top + 80;
    match.puckVelocity.x = 500;
    match.puckVelocity.y = 0;

    match.update(0.1, match.player);

    expect(match.playerScore).toBe(0);
    expect(match.puckVelocity.x).toBeLessThan(0);
    expect(match.consumeEvents()).toEqual(['puck-hit']);
  });

  it('lets the player paddle return an incoming puck', () => {
    const match = new HockeyMatch(CPU_DIFFICULTIES[1]);
    match.puck.x = match.player.x + RINK.paddleRadius + RINK.puckRadius - 2;
    match.puck.y = match.player.y;
    match.puckVelocity.x = -500;
    match.puckVelocity.y = 0;

    match.update(1 / 60, match.player);

    expect(match.puckVelocity.x).toBeGreaterThan(0);
    expect(match.consumeEvents()).toContain('puck-hit');
  });

  it('ends the match when the player reaches five goals', () => {
    const match = new HockeyMatch(CPU_DIFFICULTIES[1]);
    for (let goal = 0; goal < RINK.winningScore; goal += 1) {
      match.puck.x = RINK.right - RINK.puckRadius - 1;
      match.puck.y = RINK.centerY + 80;
      match.puckVelocity.x = 500;
      match.puckVelocity.y = 0;
      match.update(0.1, match.player);
    }

    expect(match.playerScore).toBe(RINK.winningScore);
    expect(match.status).toBe('player-won');
  });
});
