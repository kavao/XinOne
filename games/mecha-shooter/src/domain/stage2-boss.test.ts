import { describe, expect, it, vi } from 'vitest';
import { MechaShooterMatch, type Bullet, type Enemy } from './mecha-shooter';
import { createStage2BossState, drillHitsPlayer, getArmMuzzle, getDrillScale, getStage2WeakPoint, updateStage2Boss } from './stage2-boss';

const STEP = 1 / 60;

function bossFight() {
  const match = new MechaShooterMatch(2);
  match.invulnerableSeconds = 1000;
  const boss: Enemy = { x: 640, y: 145, kind: 'boss', width: 150, height: 90, hp: 170, maxHp: 170, phase: 0, stage2Boss: createStage2BossState() };
  match.enemies.push(boss);
  return { match, boss, state: boss.stage2Boss! };
}

function advance(match: MechaShooterMatch, seconds: number) {
  for (let index = 0; index < Math.ceil(seconds / STEP); index += 1) match.update(STEP, match.player);
}

function shot(match: MechaShooterMatch, x: number, y: number): void {
  match.bullets.push({ x, y, vx: 0, vy: 0, radius: 5, fromPlayer: true, damage: 3 });
  match.update(0, match.player);
}

function drill(x = 640, y = 620): Bullet {
  return { x, y, vx: 0, vy: 160, radius: 12, fromPlayer: false, damage: 1, kind: 'drill', age: 0 };
}

describe('Stage 2 Mine Warden', () => {
  it('blocks closed armor and the wrong core, but accepts shots on the exposed core', () => {
    const { match, boss, state } = bossFight();
    match.update(0, match.player);
    shot(match, boss.x - 20, boss.y - 14);
    expect(boss.hp).toBe(170);
    expect(match.bullets.filter((bullet) => bullet.fromPlayer)).toHaveLength(0);

    state.armor = 'left';
    shot(match, boss.x + 24, boss.y - 14);
    expect(boss.hp).toBe(170);
    shot(match, boss.x - 20, boss.y - 14);
    expect(boss.hp).toBe(167);

    state.armor = 'right';
    boss.damageCooldown = 0;
    shot(match, boss.x - 20, boss.y - 14);
    expect(boss.hp).toBe(167);
    shot(match, boss.x + 24, boss.y - 14);
    expect(boss.hp).toBe(164);
  });

  it('lets a real upward shot pass the legs and reach the moving chest core', () => {
    const { match, boss, state } = bossFight();
    state.armor = 'left';
    state.armorSeconds = 5;
    match.update(0, match.player);
    match.bullets.push({ x: boss.x - 20, y: boss.y + 85, vx: 90, vy: -520, radius: 5, fromPlayer: true, damage: 2 });
    advance(match, 0.2);
    expect(boss.hp).toBe(168);
  });

  it('alternates left and right weak points with short closed intervals', () => {
    const { match, boss, state } = bossFight();
    expect(getStage2WeakPoint(boss)).toBeUndefined();
    advance(match, 1.5);
    expect(state.armor).toBe('left');
    advance(match, 4.6);
    expect(state.armor).toBe('closed');
    advance(match, 1.1);
    expect(state.armor).toBe('right');
  });

  it('warns before a fast drill and keeps the warned target fixed', () => {
    const { match, state } = bossFight();
    advance(match, 1.9);
    expect(state.attack).toBe('drill-charge');
    const target = { ...state.target };
    for (let index = 0; index < 30; index += 1) match.update(STEP, { x: 900, y: 600 });
    expect(match.bullets.some((bullet) => bullet.kind === 'drill')).toBe(false);
    expect(state.target).toEqual(target);
    advance(match, 0.3);
    const drills = match.bullets.filter((bullet) => bullet.kind === 'drill');
    expect(drills).toHaveLength(1);
    expect(Math.hypot(drills[0].vx, drills[0].vy)).toBeCloseTo(240);
    const velocity = { vx: drills[0].vx, vy: drills[0].vy };
    match.update(STEP, { x: 400, y: 600 });
    expect(drills[0]).toMatchObject(velocity);
  });

  it('deploys at half HP once, clears hostile bullets and exposes the central reactor after the transition', () => {
    const { match, boss, state } = bossFight();
    boss.hp = 85;
    match.bullets.push(drill());
    match.update(STEP, match.player);
    expect(state.form).toBe('transforming');
    expect(match.bullets.some((bullet) => !bullet.fromPlayer)).toBe(false);
    expect(match.consumeEvents()).toContain('boss-phase-changed');
    shot(match, boss.x, boss.y - 14);
    expect(boss.hp).toBe(85);
    match.player = { x: 640, y: 360 };
    expect(match.useBomb()).toBe(true);
    expect(boss.hp).toBe(85);
    advance(match, 1.3);
    expect(state.form).toBe('overdrive');
    expect(getStage2WeakPoint(boss)).toMatchObject({ x: boss.x, y: boss.y - 14 });
    shot(match, boss.x, boss.y - 14);
    expect(boss.hp).toBe(82);
    expect(match.consumeEvents()).not.toContain('boss-phase-changed');
    expect(boss.dashState).toBeUndefined();
  });

  it('fires two spaced drills in overdrive and telegraphs a harmless fan special', () => {
    const { match, state } = bossFight();
    state.form = 'overdrive';
    state.cooldown = 0;
    state.specialCooldown = 20;
    advance(match, 0.8);
    expect(match.bullets.filter((bullet) => bullet.kind === 'drill')).toHaveLength(1);
    advance(match, 0.5);
    const drills = match.bullets.filter((bullet) => bullet.kind === 'drill');
    expect(drills).toHaveLength(2);
    for (const bullet of drills) expect(Math.hypot(bullet.vx, bullet.vy)).toBeCloseTo(300);

    state.specialCooldown = 0;
    advance(match, 0.1);
    expect(state.attack).toBe('special-charge');
    expect(match.bullets.filter((bullet) => bullet.decorative)).toHaveLength(0);
    advance(match, 1.1);
    const fan = match.bullets.filter((bullet) => bullet.decorative);
    expect(fan).toHaveLength(18);
    expect(fan.every((bullet) => bullet.damage === 0)).toBe(true);
    expect(fan.some((bullet) => bullet.vx < 0)).toBe(true);
    expect(fan.some((bullet) => bullet.vx > 0)).toBe(true);
  });

  it('uses an inner cone hitbox, including its tip and rotated flight direction', () => {
    const bullet = drill();
    expect(drillHitsPlayer(bullet, { x: 640, y: 650 })).toBe(true);
    expect(drillHitsPlayer(bullet, { x: 663, y: 650 })).toBe(false);
    expect(drillHitsPlayer(bullet, { x: 660, y: 600 })).toBe(false);
    expect(drillHitsPlayer(bullet, { x: 640, y: 663 })).toBe(false);
    bullet.vx = 160;
    bullet.vy = 0;
    expect(drillHitsPlayer(bullet, { x: 670, y: 620 })).toBe(true);
    expect(drillHitsPlayer(bullet, { x: 670, y: 643 })).toBe(false);
  });

  it('grows drills smoothly by travel distance to twice their initial size', () => {
    const bullet = drill();
    expect(getDrillScale(bullet)).toBe(1);
    const earlier = getDrillScale({ ...bullet, vy: 240, age: 0.2 });
    const halfway = getDrillScale({ ...bullet, vy: 240, age: 0.375 });
    expect(earlier).toBeGreaterThan(1);
    expect(earlier).toBeLessThan(halfway);
    expect(halfway).toBeCloseTo(1.5);
    // Different speeds produce the same scale after covering the same distance.
    expect(getDrillScale({ ...bullet, vy: 300, age: 0.3 })).toBeCloseTo(halfway);
    expect(getDrillScale({ ...bullet, vy: 240, age: 0.75 })).toBe(2);
    expect(getDrillScale({ ...bullet, age: 100 })).toBe(2);
  });

  it('expands the inner drill hitbox with the sprite while keeping its transparent edges safe', () => {
    const small = drill();
    const large = { ...small, age: 2 };
    expect(drillHitsPlayer(small, { x: 664, y: 600 })).toBe(false);
    expect(drillHitsPlayer(large, { x: 664, y: 600 })).toBe(true);
    expect(drillHitsPlayer(small, { x: 640, y: 676 })).toBe(false);
    expect(drillHitsPlayer(large, { x: 640, y: 676 })).toBe(true);
    expect(drillHitsPlayer(large, { x: 689, y: 620 })).toBe(false);
    expect(drillHitsPlayer(large, { x: 640, y: 700 })).toBe(false);
  });

  it('shoots slow live rounds from the right arm within 30 degrees of the player', () => {
    const { boss, state } = bossFight();
    const target = { x: 640, y: 620 };
    const random = vi.spyOn(Math, 'random');
    try {
      for (const sample of [0, 0.5, 0.999]) {
        state.armChargeSeconds = 0.01;
        random.mockReturnValue(sample);
        const result = updateStage2Boss(boss, STEP, target);
        const bullets = result.bullets.filter((bullet) => bullet.kind === 'suppressive');
        expect(bullets).toHaveLength(1);
        const bullet = bullets[0];
        const muzzle = getArmMuzzle(boss);
        expect(bullet).toMatchObject({ ...muzzle, fromPlayer: false, damage: 1, radius: 6 });
        expect(muzzle.x).toBeGreaterThan(boss.x);
        expect(Math.hypot(bullet.vx, bullet.vy)).toBeCloseTo(95);
        const aim = Math.atan2(target.y - muzzle.y, target.x - muzzle.x);
        const angle = Math.atan2(bullet.vy, bullet.vx);
        expect(Math.abs(angle - aim)).toBeLessThanOrEqual(Math.PI / 6 + 1e-10);
        expect(angle - aim).toBeCloseTo((sample * 2 - 1) * Math.PI / 6);
      }
    } finally {
      random.mockRestore();
    }
  });

  it('telegraphs right-arm shots and releases a modest stream alongside the drill attacks', () => {
    const { boss, state } = bossFight();
    state.armCooldown = 0;
    expect(updateStage2Boss(boss, STEP, { x: 640, y: 620 }).bullets).toHaveLength(0);
    expect(state.armChargeSeconds).toBeGreaterThan(0);
    let slowShots = 0;
    let drills = 0;
    for (let frame = 0; frame < 60 * 6; frame += 1) {
      const result = updateStage2Boss(boss, STEP, { x: 640, y: 620 });
      slowShots += result.bullets.filter((bullet) => bullet.kind === 'suppressive').length;
      drills += result.bullets.filter((bullet) => bullet.kind === 'drill').length;
    }
    expect(slowShots).toBeGreaterThanOrEqual(4);
    expect(slowShots).toBeLessThanOrEqual(7);
    expect(drills).toBeGreaterThan(0);
    boss.hp = 85;
    updateStage2Boss(boss, STEP, { x: 640, y: 620 });
    expect(state.armChargeSeconds).toBe(0);
    for (let frame = 0; frame < 30; frame += 1) expect(updateStage2Boss(boss, STEP, { x: 640, y: 620 }).bullets).toHaveLength(0);
  });

  it('keeps slow rounds on their fired path when the player changes direction', () => {
    const { match, boss, state } = bossFight();
    state.armChargeSeconds = 0.01;
    const result = updateStage2Boss(boss, STEP, match.player);
    const bullet = result.bullets.find((item) => item.kind === 'suppressive')!;
    const velocity = { vx: bullet.vx, vy: bullet.vy };
    const origin = { x: bullet.x, y: bullet.y };
    match.bullets.push(bullet);
    match.update(STEP, { x: 400, y: 400 });
    expect(bullet).toMatchObject(velocity);
    expect(bullet.x).toBeCloseTo(origin.x + velocity.vx * STEP);
    expect(bullet.y).toBeCloseTo(origin.y + velocity.vy * STEP);
  });

  it('a drill costs one life, while decorative special bullets never hit', () => {
    const { match } = bossFight();
    match.invulnerableSeconds = 0;
    match.bullets.push({ ...drill(), decorative: true, damage: 0 });
    match.update(0, match.player);
    expect(match.lives).toBe(3);
    match.bullets.push(drill());
    match.update(0, match.player);
    expect(match.lives).toBe(2);
    expect(match.consumeEvents()).toContain('player-hit');
  });

  it('bombs erase drills, cap boss damage and suppress shots throughout the active bomb', () => {
    const { match, boss, state } = bossFight();
    match.player = { x: 640, y: 360 };
    match.bullets.push(drill());
    match.bullets.push({ x: 640, y: 360, vx: 0, vy: 95, radius: 6, fromPlayer: false, damage: 1, kind: 'suppressive' });
    state.attack = 'drill-charge';
    state.attackSeconds = 0.1;
    state.shotsRemaining = 1;
    state.armChargeSeconds = 0.1;
    expect(match.useBomb()).toBe(true);
    expect(boss.hp).toBe(170 - 170 / 4);
    advance(match, 0.3);
    expect(match.bullets.some((bullet) => !bullet.fromPlayer)).toBe(false);
    expect(match.lives).toBe(3);
  });

  it('spawns the real Stage 2 boss and allows auto-fire to finish both phases and clear', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(1);
    try {
      const match = new MechaShooterMatch(2);
      match.invulnerableSeconds = 1000;
      advance(match, 26.7);
      const boss = match.enemies.find((enemy) => enemy.kind === 'boss')!;
      expect(boss.stage2Boss?.form).toBe('normal');
      match.enemies = [boss];
      let sawOverdrive = false;
      // Aim slightly ahead of the moving core to account for the shot's flight time.
      for (let frame = 0; frame < 60 * 120 && match.status === 'playing'; frame += 1) {
        const weak = getStage2WeakPoint(boss);
        const lead = Math.cos(boss.phase * 0.45) * 90 * 0.25;
        const target = { x: (weak?.x ?? boss.x) + lead, y: boss.y + 155 };
        if (frame % 10 === 0) match.shoot();
        match.update(STEP, target);
        sawOverdrive ||= boss.stage2Boss?.form === 'overdrive';
      }
      expect(sawOverdrive).toBe(true);
      expect(match.status).toBe('clear');
      expect(match.score).toBe(5000);
      expect(match.consumeEvents().filter((event) => event === 'clear')).toHaveLength(1);
      match.update(STEP, match.player);
      expect(match.consumeEvents()).toEqual([]);
    } finally {
      random.mockRestore();
    }
  });

  it('keeps the Stage 1 low-HP dash behavior', () => {
    const match = new MechaShooterMatch(1);
    const boss: Enemy = { x: 640, y: 120, kind: 'boss', width: 150, height: 90, hp: 40, maxHp: 120, phase: 0 };
    match.enemies.push(boss);
    match.update(STEP, match.player);
    expect(boss.dashState).toBe('telegraph');
    expect(boss.stage2Boss).toBeUndefined();
  });

  it('does not replace a last-life defeat with victory on a simultaneous boss kill', () => {
    const match = new MechaShooterMatch(2);
    match.invulnerableSeconds = 1000;
    advance(match, 26.7);
    const boss = match.enemies.find((enemy) => enemy.kind === 'boss')!;
    match.enemies = [boss];
    boss.stage2Boss!.form = 'overdrive';
    boss.hp = 1;
    match.lives = 1;
    match.invulnerableSeconds = 0;
    match.consumeEvents();
    match.bullets = [
      { x: boss.x, y: boss.y - 14, vx: 0, vy: 0, radius: 5, fromPlayer: true, damage: 1 },
      drill(match.player.x, match.player.y),
    ];
    match.update(0, match.player);
    expect(match.status).toBe('game-over');
    expect(match.consumeEvents()).toContain('game-over');
  });
});
