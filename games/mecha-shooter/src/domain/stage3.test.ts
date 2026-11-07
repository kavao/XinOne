import { describe, expect, it, vi } from 'vitest';
import { MechaShooterMatch, type Enemy, type Point } from './mecha-shooter';
import { createDiverState, createStage3BossState, STAGE3_BOSS_SIZE, STAGE3_SAFE_WIDTH, updateDiver, updateStage3Boss } from './stage3';

const STEP = 1 / 60;

function advance(match: MechaShooterMatch, seconds: number) {
  for (let frame = 0; frame < Math.ceil(seconds / STEP); frame += 1) match.update(STEP, match.player);
}

function commander(): Enemy {
  return { x: 640, y: 190, kind: 'boss', width: 150, height: 90, hp: 360, maxHp: 360, phase: 0, stage3Boss: createStage3BossState() };
}

function bossFight() {
  const match = new MechaShooterMatch(3);
  match.invulnerableSeconds = 1000;
  advance(match, 32.7);
  const boss = match.enemies.find((enemy) => enemy.kind === 'boss')!;
  boss.stage3Boss = createStage3BossState();
  match.consumeEvents();
  return { match, boss, state: boss.stage3Boss };
}

function shot(match: MechaShooterMatch, point: Point) {
  match.bullets.push({ ...point, vx: 0, vy: 0, radius: 5, fromPlayer: true, damage: 3 });
  match.update(0, match.player);
}

describe('Stage 3 citadel waves and Divers', () => {
  it('introduces Divers, reinforced escorts and fixed resource carriers only in Stage 3', () => {
    const match = new MechaShooterMatch(3);
    match.update(0, match.player);
    expect(match.enemies.some((enemy) => enemy.kind === 'diver')).toBe(true);
    expect(match.enemies.find((enemy) => enemy.kind === 'striker')?.hp).toBe(4);
    expect(match.enemies.some((enemy) => enemy.resourceKind === 'POWER')).toBe(true);
    advance(match, 1.7);
    expect(match.enemies.some((enemy) => enemy.kind === 'guard' && enemy.resourceKind === 'SHIELD')).toBe(true);
    for (const stage of [1, 2]) {
      const earlier = new MechaShooterMatch(stage);
      earlier.update(0, earlier.player);
      expect(earlier.enemies.some((enemy) => enemy.kind === 'diver')).toBe(false);
    }
  });

  it('warns before diving and keeps its chosen direction after the player moves', () => {
    const enemy: Enemy = { x: 500, y: 40, kind: 'diver', width: 30, height: 42, hp: 8, maxHp: 8, phase: 0, diver: createDiverState() };
    updateDiver(enemy, 0.61, { x: 640, y: 620 });
    expect(enemy.diver?.mode).toBe('telegraph');
    const origin = { x: enemy.x, y: enemy.y };
    updateDiver(enemy, 0.3, { x: 900, y: 500 });
    expect(enemy).toMatchObject(origin);
    expect(enemy.diver?.target).toEqual({ x: 640, y: 620 });
    updateDiver(enemy, 0.36, { x: 900, y: 500 });
    expect(enemy.diver?.mode).toBe('diving');
    const velocity = { ...enemy.diver!.velocity };
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(640);
    updateDiver(enemy, 0.1, { x: 350, y: 600 });
    expect(enemy.diver?.velocity.x).toBeCloseTo(velocity.x);
    expect(enemy.diver?.velocity.y).toBeCloseTo(velocity.y);
    expect(enemy.x).toBeCloseTo(origin.x + velocity.x * 0.1);
    expect(enemy.y).toBeCloseTo(origin.y + velocity.y * 0.1);
    updateDiver(enemy, 0.3, { x: 900, y: 80 });
    const accelerating = enemy.diver!.velocity;
    expect(Math.hypot(accelerating.x, accelerating.y)).toBeGreaterThan(640);
    expect(Math.hypot(accelerating.x, accelerating.y)).toBeLessThan(1100);
    expect(Math.atan2(accelerating.y, accelerating.x)).toBeCloseTo(Math.atan2(velocity.y, velocity.x));
    updateDiver(enemy, 0.5, { x: 350, y: 80 });
    expect(Math.hypot(enemy.diver!.velocity.x, enemy.diver!.velocity.y)).toBeCloseTo(1100);
    expect(Math.atan2(enemy.diver!.velocity.y, enemy.diver!.velocity.x)).toBeCloseTo(Math.atan2(velocity.y, velocity.x));
  });

  it('keeps the accelerating dive consistent at 30, 60 and 120 frames per second', () => {
    const positions = [30, 60, 120].map((fps) => {
      const enemy: Enemy = { x: 500, y: 40, kind: 'diver', width: 30, height: 42, hp: 8, maxHp: 8, phase: 0, diver: createDiverState() };
      enemy.diver!.mode = 'diving';
      enemy.diver!.velocity = { x: 384, y: 512 };
      for (let frame = 0; frame < fps; frame += 1) updateDiver(enemy, 1 / fps, { x: 900, y: 620 });
      expect(Math.hypot(enemy.diver!.velocity.x, enemy.diver!.velocity.y)).toBeCloseTo(1100);
      return { x: enemy.x, y: enemy.y };
    });
    for (const position of positions) {
      expect(position.x).toBeCloseTo(positions[0].x, 6);
      expect(position.y).toBeCloseTo(positions[0].y, 6);
    }
  });

  it('survives a power-three shot but remains destructible by sustained fire', () => {
    const match = new MechaShooterMatch(3);
    match.update(0, match.player);
    const diver = match.enemies.find((enemy) => enemy.kind === 'diver')!;
    match.enemies = [diver];
    expect(diver.hp).toBe(8);
    shot(match, diver);
    expect(diver.hp).toBe(5);
    expect(match.enemies).toContain(diver);
    for (let hit = 0; hit < 2; hit += 1) shot(match, diver);
    expect(match.enemies).toHaveLength(0);
    expect(match.score).toBe(220);
  });

  it('allows a Diver to be shot down during its warning', () => {
    const match = new MechaShooterMatch(3);
    match.update(0, match.player);
    const diver = match.enemies.find((enemy) => enemy.kind === 'diver')!;
    match.enemies = [diver];
    diver.diver!.mode = 'telegraph';
    diver.hp = 1;
    shot(match, diver);
    expect(match.enemies).toHaveLength(0);
    expect(match.score).toBe(220);
    expect(match.consumeDestroyed()).toEqual([{ x: diver.x, y: diver.y, kind: 'diver' }]);
  });
});

describe('Stage 3 Sky Commander', () => {
  it('arrives after Stage 3 waves and clears surviving escorts before the boss fight', () => {
    const { match, boss, state } = bossFight();
    expect(match.enemies).toHaveLength(1);
    expect(boss.hp).toBe(360);
    expect(state.mode).toBe('flight');
    expect(boss.stage2Boss).toBeUndefined();
    expect(boss.dashState).toBeUndefined();
  });

  it('patrols every quadrant of the field in flight while keeping the entire sprite inside', () => {
    const boss = commander();
    const quadrants = new Set<string>();
    let top = Infinity;
    let bottom = -Infinity;
    for (let frame = 0; frame < 60 * 6; frame += 1) {
      boss.phase += STEP;
      updateStage3Boss(boss, STEP, { x: 640, y: 620 });
      expect(boss.stage3Boss!.mode).toBe('flight');
      expect(boss.x - STAGE3_BOSS_SIZE.width / 2).toBeGreaterThanOrEqual(300);
      expect(boss.x + STAGE3_BOSS_SIZE.width / 2).toBeLessThanOrEqual(980);
      expect(boss.y - STAGE3_BOSS_SIZE.height / 2).toBeGreaterThanOrEqual(0);
      expect(boss.y + STAGE3_BOSS_SIZE.height / 2).toBeLessThanOrEqual(720);
      quadrants.add(`${boss.x < 640 ? 'left' : 'right'}-${boss.y < 380 ? 'top' : 'bottom'}`);
      top = Math.min(top, boss.y);
      bottom = Math.max(bottom, boss.y);
    }
    expect(quadrants.size).toBe(4);
    expect(top).toBeLessThan(200);
    expect(bottom).toBeGreaterThan(580);
  });

  it('keeps humanoid and final forms in the existing upper-screen area', () => {
    for (const final of [false, true]) {
      const boss = commander();
      boss.stage3Boss!.mode = 'humanoid';
      boss.stage3Boss!.final = final;
      for (let frame = 0; frame < 60 * 6; frame += 1) {
        boss.phase += STEP;
        updateStage3Boss(boss, STEP, { x: 640, y: 620 });
        expect(boss.y).toBeGreaterThanOrEqual(176);
        expect(boss.y).toBeLessThanOrEqual(204);
        expect(boss.x).toBeGreaterThanOrEqual(460);
        expect(boss.x).toBeLessThanOrEqual(820);
      }
    }
  });

  it.each(['humanoid', 'flight', 'final'] as const)('moves smoothly to the %s position during transformation', (destination) => {
    const boss = commander();
    const state = boss.stage3Boss!;
    state.mode = destination === 'flight' ? 'humanoid' : 'flight';
    boss.x = 800;
    boss.y = destination === 'flight' ? 190 : 600;
    const origin = { x: boss.x, y: boss.y };
    state.formSeconds = 0.001;
    if (destination === 'final') boss.hp = 120;
    const change = updateStage3Boss(boss, STEP, { x: 640, y: 620 });
    expect(change.phaseChanged).toBe(true);
    expect(boss).toMatchObject(origin);
    for (let frame = 0; frame < 60 * 1.2; frame += 1) {
      const before = { x: boss.x, y: boss.y };
      boss.phase += STEP;
      updateStage3Boss(boss, STEP, { x: 640, y: 620 });
      expect(Math.hypot(boss.x - before.x, boss.y - before.y)).toBeLessThan(30);
    }
    expect(state.transformSeconds).toBe(0);
    expect(state.mode).toBe(destination === 'flight' ? 'flight' : 'humanoid');
    expect(boss.y).toBeLessThan(210);
  });

  it('aims flight volleys upward when the player is above the patrolling boss', () => {
    const boss = commander();
    const state = boss.stage3Boss!;
    state.patrolSeconds = 3.25;
    state.cooldown = 0;
    updateStage3Boss(boss, 0, { x: 640, y: 200 });
    expect(boss.y).toBeGreaterThan(580);
    const shot = updateStage3Boss(boss, 0.51, { x: 900, y: 620 });
    const live = shot.bullets.filter((bullet) => !bullet.decorative);
    expect(live).toHaveLength(3);
    expect(live.every((bullet) => bullet.vy < 0)).toBe(true);
    expect(state.target).toEqual({ x: 640, y: 200 });
  });

  it('switches between flight and humanoid forms without inheriting the Stage 1 dash', () => {
    const { match, boss, state } = bossFight();
    advance(match, 6.6);
    expect(state.mode).toBe('humanoid');
    expect(state.transformSeconds).toBeGreaterThan(0);
    const hp = boss.hp;
    shot(match, boss);
    expect(boss.hp).toBe(hp);
    advance(match, 1);
    shot(match, boss);
    expect(boss.hp).toBe(hp - 3);
    advance(match, 6.5);
    expect(state.mode).toBe('flight');
    expect(boss.dashState).toBeUndefined();
  });

  it('telegraphs distinct aimed and fan volleys with harmless decorative bullets', () => {
    const boss = commander();
    const state = boss.stage3Boss!;
    state.cooldown = 0;
    expect(updateStage3Boss(boss, 0, { x: 500, y: 600 }).bullets).toHaveLength(0);
    expect(state.attack).toBe('volley-charge');
    const flight = updateStage3Boss(boss, 0.6, { x: 900, y: 620 }).bullets;
    expect(flight.filter((bullet) => !bullet.decorative)).toHaveLength(3);
    expect(state.target).toEqual({ x: 500, y: 600 });
    expect(flight.filter((bullet) => bullet.decorative).every((bullet) => bullet.damage === 0)).toBe(true);
    expect(state.attack).toBe('volley-burst');
    expect(updateStage3Boss(boss, 0.1, { x: 900, y: 620 }).bullets).toHaveLength(0);
    const second = updateStage3Boss(boss, 0.13, { x: 900, y: 620 }).bullets.filter((bullet) => !bullet.decorative);
    expect(second).toHaveLength(3);
    const third = updateStage3Boss(boss, 0.23, { x: 900, y: 620 }).bullets.filter((bullet) => !bullet.decorative);
    expect(third).toHaveLength(3);
    expect(state.attack).toBe('idle');
    expect(state.target).toEqual({ x: 500, y: 600 });
    state.mode = 'humanoid';
    state.cooldown = 0;
    updateStage3Boss(boss, 0, { x: 500, y: 600 });
    const fan = updateStage3Boss(boss, 0.8, { x: 500, y: 600 }).bullets.filter((bullet) => !bullet.decorative);
    expect(fan).toHaveLength(5);
    expect(fan.some((bullet) => bullet.vx < 0)).toBe(true);
    expect(fan.some((bullet) => bullet.vx > 0)).toBe(true);
    expect(fan.every((bullet) => Math.abs(Math.hypot(bullet.vx, bullet.vy) - 320) < 1e-8)).toBe(true);
    expect(state.attack).toBe('volley-burst');
  });

  it('fires three faster waves on each of the five humanoid fan directions', () => {
    const boss = commander();
    const state = boss.stage3Boss!;
    state.mode = 'humanoid';
    state.cooldown = 0;
    expect(updateStage3Boss(boss, 0, { x: 640, y: 620 }).bullets).toHaveLength(0);
    expect(state.attack).toBe('volley-charge');
    expect(updateStage3Boss(boss, 0.6, { x: 640, y: 620 }).bullets).toHaveLength(0);
    const first = updateStage3Boss(boss, 0.11, { x: 640, y: 620 }).bullets;
    expect(updateStage3Boss(boss, 0.1, { x: 640, y: 620 }).bullets).toHaveLength(0);
    const second = updateStage3Boss(boss, 0.05, { x: 640, y: 620 }).bullets;
    const third = updateStage3Boss(boss, 0.15, { x: 640, y: 620 }).bullets;
    const waves = [first, second, third].map((wave) => wave.filter((bullet) => !bullet.decorative));
    expect(waves.flat()).toHaveLength(15);
    for (let round = 0; round < waves.length; round += 1) {
      expect(waves[round]).toHaveLength(5);
      for (let direction = 0; direction < 5; direction += 1) {
        const bullet = waves[round][direction];
        expect(Math.hypot(bullet.vx, bullet.vy)).toBeCloseTo([320, 360, 400][round]);
        expect(Math.atan2(bullet.vx, bullet.vy)).toBeCloseTo(Math.atan2(waves[0][direction].vx, waves[0][direction].vy));
      }
    }
    expect([...first, ...second, ...third].filter((bullet) => bullet.decorative).every((bullet) => bullet.damage === 0)).toBe(true);
    expect(state.attack).toBe('idle');
    expect(state.volleyWaves).toBe(0);
    expect(state.cooldown).toBeCloseTo(1.6);
  });

  it('cancels unfinished flight bursts when transforming or entering the final barrage', () => {
    const boss = commander();
    const state = boss.stage3Boss!;
    state.attack = 'volley-burst';
    state.volleyWaves = 2;
    state.formSeconds = 0.01;
    expect(updateStage3Boss(boss, 0.02, { x: 640, y: 620 }).phaseChanged).toBe(true);
    expect(state.mode).toBe('humanoid');
    expect(state.volleyWaves).toBe(0);
    expect(state.attack).toBe('idle');
    state.attack = 'volley-burst';
    state.volleyWaves = 2;
    boss.hp = 120;
    const final = updateStage3Boss(boss, 0.02, { x: 640, y: 620 });
    expect(final.clearHostile).toBe(true);
    expect(final.bullets).toHaveLength(0);
    expect(state.final).toBe(true);
    expect(state.volleyWaves).toBe(0);
    expect(state.attack).toBe('idle');
  });

  it('enters the final humanoid phase at one third HP, clearing hostile fire', () => {
    const { match, boss, state } = bossFight();
    boss.hp = 120;
    match.bullets.push({ x: 640, y: 400, vx: 0, vy: 160, radius: 5, fromPlayer: false, damage: 1, kind: 'citadel' });
    match.update(STEP, match.player);
    expect(state.final).toBe(true);
    expect(state.mode).toBe('humanoid');
    expect(state.transformSeconds).toBeGreaterThan(0);
    expect(match.bullets.some((bullet) => !bullet.fromPlayer)).toBe(false);
    expect(match.consumeEvents()).toContain('boss-phase-changed');
    match.player = { x: boss.x, y: boss.y + 160 };
    expect(match.useBomb()).toBe(true);
    expect(boss.hp).toBe(120);
  });

  it('keeps the same wide safe corridor for both wall waves and warns before moving it', () => {
    const boss = commander();
    const state = boss.stage3Boss!;
    state.final = true;
    state.cooldown = 0;
    const warning = updateStage3Boss(boss, 0, { x: 640, y: 620 });
    expect(warning.clearHostile).toBe(true);
    expect(warning.bullets).toHaveLength(0);
    expect(state.attack).toBe('wall-charge');
    expect(state.attackSeconds).toBeGreaterThanOrEqual(1);
    const lane = state.safeLaneX;
    for (const [round, delta] of [1.11, 0.29].entries()) {
      const result = updateStage3Boss(boss, delta, { x: 640, y: 620 });
      const wall = result.bullets.filter((bullet) => bullet.kind === 'wall');
      expect(wall.length).toBeGreaterThan(4);
      expect(wall.every((bullet) => bullet.vy === [280, 320][round])).toBe(true);
      expect(state.safeLaneX).toBe(lane);
      expect(wall.every((bullet) => Math.abs(bullet.x - lane) - bullet.radius > STAGE3_SAFE_WIDTH / 2)).toBe(true);
    }
    const next = updateStage3Boss(boss, 3.01, { x: 640, y: 620 });
    expect(next.clearHostile).toBe(true);
    expect(next.bullets).toHaveLength(0);
    expect(state.safeLaneX).not.toBe(lane);
    expect(state.attack).toBe('wall-charge');
  });

  it('lets a vulnerable player survive successive final walls by following the safe corridors', () => {
    const { match, state } = bossFight();
    state.final = true;
    state.cooldown = 0;
    match.invulnerableSeconds = 0;
    match.bullets = [];
    match.player = { x: state.safeLaneX, y: 620 };
    const lanes = new Set<number>();
    for (let frame = 0; frame < 60 * 16; frame += 1) {
      lanes.add(state.safeLaneX);
      match.update(STEP, { x: state.safeLaneX, y: 620 });
    }
    expect(lanes.size).toBe(3);
    expect(match.lives).toBe(3);
    expect(match.status).toBe('playing');
  });

  it('caps bomb damage and erases both live and decorative citadel projectiles', () => {
    const { match, boss, state } = bossFight();
    match.player = { x: boss.x, y: boss.y + 160 };
    match.bullets.push(
      { x: 400, y: 400, vx: 0, vy: 160, radius: 5, fromPlayer: false, damage: 1, kind: 'wall' },
      { x: 500, y: 400, vx: 0, vy: 120, radius: 4, fromPlayer: false, damage: 0, decorative: true, kind: 'citadel' },
    );
    state.attack = 'volley-charge';
    state.attackSeconds = 0.1;
    expect(match.useBomb()).toBe(true);
    expect(boss.hp).toBe(270);
    advance(match, 0.3);
    expect(match.bullets.some((bullet) => !bullet.fromPlayer)).toBe(false);
  });

  it('allows real auto-fire to defeat the final boss through both forms and the final barrage', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const { match, boss, state } = bossFight();
      let sawHumanoid = false;
      let sawFinal = false;
      for (let frame = 0; frame < 60 * 180 && match.status === 'playing'; frame += 1) {
        if (frame % 10 === 0) match.shoot();
        match.update(STEP, { x: boss.x, y: boss.y + 200 });
        sawHumanoid ||= state.mode === 'humanoid';
        sawFinal ||= state.final;
      }
      expect(sawHumanoid).toBe(true);
      expect(sawFinal).toBe(true);
      expect(match.status).toBe('clear');
      expect(match.score).toBe(5000);
      expect(match.bullets.some((bullet) => !bullet.fromPlayer)).toBe(false);
      expect(match.consumeEvents().filter((event) => event === 'clear')).toHaveLength(1);
    } finally {
      random.mockRestore();
    }
  });
});
