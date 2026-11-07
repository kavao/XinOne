import type { Bullet, Enemy, Point } from './mecha-shooter';

export const STAGE3_BOSS_SIZE = { width: 280, height: 210 } as const;
export const STAGE3_SAFE_WIDTH = 160;
const SAFE_LANES = [430, 850, 640] as const;
const HUMANOID_FAN_SPEEDS = [320, 360, 400] as const;

export interface DiverState {
  mode: 'approach' | 'telegraph' | 'diving';
  seconds: number;
  target: Point;
  velocity: Point;
  diveSeconds: number;
}

export function createDiverState(): DiverState {
  return { mode: 'approach', seconds: 0.6, target: { x: 640, y: 620 }, velocity: { x: 0, y: 0 }, diveSeconds: 0 };
}

// Integrate the acceleration exactly so the dive follows the same path at different frame rates.
function diveDistance(seconds: number): number {
  const accelerating = Math.max(0, Math.min(0.45, seconds - 0.2));
  const cruising = Math.max(0, seconds - 0.65);
  return 640 * seconds + 460 * accelerating * accelerating / (2 * 0.45) + 460 * cruising;
}

export function updateDiver(enemy: Enemy, delta: number, player: Point): void {
  const state = enemy.diver ??= createDiverState();
  if (state.mode === 'diving') {
    const previousSpeed = Math.hypot(state.velocity.x, state.velocity.y);
    const ux = previousSpeed > 0 ? state.velocity.x / previousSpeed : 0;
    const uy = previousSpeed > 0 ? state.velocity.y / previousSpeed : 1;
    const nextSeconds = state.diveSeconds + delta;
    const distance = diveDistance(nextSeconds) - diveDistance(state.diveSeconds);
    const nextSpeed = 640 + 460 * Math.max(0, Math.min(1, (nextSeconds - 0.2) / 0.45));
    enemy.x += ux * distance;
    enemy.y += uy * distance;
    state.velocity = { x: ux * nextSpeed, y: uy * nextSpeed };
    state.diveSeconds = nextSeconds;
    return;
  }
  state.seconds -= delta;
  if (state.mode === 'approach') {
    enemy.y += 45 * delta;
    if (state.seconds <= 0) {
      state.mode = 'telegraph';
      state.seconds = 0.65;
      state.target = { ...player };
    }
  } else if (state.seconds <= 0) {
    const dx = state.target.x - enemy.x;
    const dy = Math.max(120, state.target.y - enemy.y);
    const length = Math.hypot(dx, dy);
    state.velocity = { x: dx / length * 640, y: dy / length * 640 };
    state.diveSeconds = 0;
    state.mode = 'diving';
  }
}

export interface Stage3BossState {
  mode: 'flight' | 'humanoid';
  final: boolean;
  formSeconds: number;
  patrolSeconds: number;
  transformSeconds: number;
  transformDuration: number;
  transformFrom: Point;
  attack: 'idle' | 'volley-charge' | 'volley-burst' | 'wall-charge' | 'wall-burst';
  attackSeconds: number;
  cooldown: number;
  attackIndex: number;
  wallWaves: number;
  volleyWaves: number;
  safeLaneX: number;
  target: Point;
}

export function createStage3BossState(): Stage3BossState {
  return {
    mode: 'flight', final: false, formSeconds: 6.5, patrolSeconds: 0,
    transformSeconds: 0, transformDuration: 0.9, transformFrom: { x: 640, y: 160 },
    attack: 'idle', attackSeconds: 0, cooldown: 1.2, attackIndex: 0,
    wallWaves: 0, volleyWaves: 0, safeLaneX: 430, target: { x: 640, y: 620 },
  };
}

function commanderPosition(enemy: Enemy, state: Stage3BossState): Point {
  if (state.mode === 'flight' && !state.final) {
    const angle = state.patrolSeconds * Math.PI * 2 / 6.5;
    return { x: 640 + Math.sin(angle) * 190, y: 380 - Math.cos(angle) * 220 };
  }
  return { x: 640 + Math.sin(enemy.phase * 0.6) * 180, y: 190 + Math.sin(enemy.phase * 0.8) * 14 };
}

function transformCommander(enemy: Enemy, state: Stage3BossState, mode: Stage3BossState['mode'], duration: number): void {
  state.transformFrom = { x: enemy.x, y: enemy.y };
  state.mode = mode;
  state.transformDuration = duration;
  state.transformSeconds = duration;
  state.attack = 'idle';
  state.volleyWaves = 0;
  if (mode === 'flight') state.patrolSeconds = 0;
}

export function updateStage3Boss(enemy: Enemy, delta: number, player: Point): { bullets: Bullet[]; clearHostile: boolean; phaseChanged: boolean } {
  const state = enemy.stage3Boss ??= createStage3BossState();
  const bullets: Bullet[] = [];

  if (!state.final && enemy.hp <= enemy.maxHp / 3) {
    state.final = true;
    transformCommander(enemy, state, 'humanoid', 1.1);
    state.attackIndex = 0;
    return { bullets, clearHostile: true, phaseChanged: true };
  }
  if (state.transformSeconds > 0) {
    state.transformSeconds = Math.max(0, state.transformSeconds - delta);
    const progress = 1 - state.transformSeconds / state.transformDuration;
    const blend = progress * progress * (3 - 2 * progress);
    const target = commanderPosition(enemy, state);
    enemy.x = state.transformFrom.x + (target.x - state.transformFrom.x) * blend;
    enemy.y = state.transformFrom.y + (target.y - state.transformFrom.y) * blend;
    if (state.transformSeconds === 0) state.cooldown = 0.6;
    return { bullets, clearHostile: false, phaseChanged: false };
  }
  if (!state.final) {
    state.formSeconds -= delta;
    if (state.formSeconds <= 0) {
      transformCommander(enemy, state, state.mode === 'flight' ? 'humanoid' : 'flight', 0.9);
      state.formSeconds = 6.5;
      return { bullets, clearHostile: true, phaseChanged: true };
    }
  }

  if (state.mode === 'flight' && !state.final) state.patrolSeconds += delta;
  const position = commanderPosition(enemy, state);
  enemy.x = position.x;
  enemy.y = position.y;

  state.cooldown = Math.max(0, state.cooldown - delta);
  if (state.attack === 'idle') {
    if (state.cooldown > 0) return { bullets, clearHostile: false, phaseChanged: false };
    state.target = { ...player };
    if (state.final) {
      state.safeLaneX = SAFE_LANES[state.attackIndex % SAFE_LANES.length];
      state.attack = 'wall-charge';
      state.attackSeconds = 1.1;
      state.wallWaves = 2;
      // Clear previous fire before indicating a guaranteed safe corridor.
      return { bullets, clearHostile: true, phaseChanged: false };
    }
    state.attack = 'volley-charge';
    state.attackSeconds = state.mode === 'flight' ? 0.5 : 0.7;
    state.volleyWaves = 3;
    return { bullets, clearHostile: false, phaseChanged: false };
  }

  state.attackSeconds -= delta;
  if (state.attackSeconds > 0) return { bullets, clearHostile: false, phaseChanged: false };
  if (state.attack === 'wall-charge' || state.attack === 'wall-burst') {
    const speed = state.wallWaves === 2 ? 280 : 320;
    for (let x = 324; x <= 956; x += 56) {
      if (Math.abs(x - state.safeLaneX) < STAGE3_SAFE_WIDTH / 2 + 20) continue;
      bullets.push({ x, y: enemy.y + 65, vx: 0, vy: speed, radius: 5, fromPlayer: false, damage: 1, kind: 'wall' });
    }
    for (let index = 0; index < 16; index += 1) {
      const angle = index * Math.PI * 2 / 16;
      bullets.push({ x: enemy.x, y: enemy.y, vx: Math.sin(angle) * 185, vy: Math.cos(angle) * 185, radius: 4, fromPlayer: false, damage: 0, decorative: true, kind: 'citadel' });
    }
    state.wallWaves -= 1;
    if (state.wallWaves > 0) {
      state.attack = 'wall-burst';
      state.attackSeconds = 0.28;
    } else {
      state.attack = 'idle';
      state.cooldown = 2.6;
      state.attackIndex += 1;
    }
  } else {
    const aimed = Math.atan2(state.target.x - enemy.x, state.target.y - enemy.y - 50);
    const offsets = state.mode === 'flight' ? [-0.17, 0, 0.17] : [-0.65, -0.325, 0, 0.325, 0.65];
    const round = Math.max(0, Math.min(2, 3 - state.volleyWaves));
    const speed = state.mode === 'flight' ? 215 : HUMANOID_FAN_SPEEDS[round];
    for (const offset of offsets) {
      const angle = state.mode === 'flight' ? aimed + offset : offset + Math.sin(state.attackIndex) * 0.12;
      bullets.push({ x: enemy.x, y: enemy.y + 50, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed, radius: 5, fromPlayer: false, damage: 1, kind: 'citadel' });
    }
    for (const side of [-1, 1]) {
      for (let index = 0; index < 4; index += 1) {
        const angle = side * (0.85 + index * 0.15);
        const decorativeSpeed = state.mode === 'flight' ? 135 : 185;
        bullets.push({ x: enemy.x + side * 65, y: enemy.y, vx: Math.sin(angle) * decorativeSpeed, vy: Math.cos(angle) * decorativeSpeed, radius: 4, fromPlayer: false, damage: 0, decorative: true, kind: 'citadel' });
      }
    }
    state.volleyWaves -= 1;
    if (state.volleyWaves > 0) {
      state.attack = 'volley-burst';
      state.attackSeconds = state.mode === 'flight' ? 0.22 : 0.14;
    } else {
      state.attack = 'idle';
      state.cooldown = 1.6;
      state.attackIndex += 1;
    }
  }
  return { bullets, clearHostile: false, phaseChanged: false };
}
