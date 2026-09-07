import { describe, expect, it } from 'vitest';
import { MechaShooterMatch } from './mecha-shooter';

describe('MechaShooterMatch', () => {
  it('starts with three lives and three bombs', () => {
    const match = new MechaShooterMatch();
    expect(match.snapshot()).toMatchObject({ lives: 3, bombCount: 3, status: 'playing' });
  });

  it('fires only while playing and consumes a bomb', () => {
    const match = new MechaShooterMatch();
    match.shoot();
    expect(match.snapshot().bullets.some((bullet) => bullet.fromPlayer)).toBe(true);
    expect(match.useBomb()).toBe(true);
    expect(match.snapshot().bombCount).toBe(2);
    expect(match.useBomb()).toBe(false);
    for (let index = 0; index < 75; index += 1) match.update(0.033, { x: 640, y: 620 });
    expect(match.snapshot().bombActiveSeconds).toBe(0);
    expect(match.useBomb()).toBe(true);
  });

  it('moves the player inside the field bounds', () => {
    const match = new MechaShooterMatch();
    match.update(0.016, { x: -100, y: -100 });
    expect(match.snapshot().player.x).toBeGreaterThan(300);
    expect(match.snapshot().player.y).toBeGreaterThan(0);
  });
});
