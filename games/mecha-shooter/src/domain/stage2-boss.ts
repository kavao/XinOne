import type { Bullet, Enemy, Point } from './mecha-shooter';

export const STAGE2_BOSS_SIZE = { width: 260, height: 190 } as const;
export const DRILL_SIZE = { width: 42, height: 72 } as const;

export interface Stage2BossState {
  form: 'normal' | 'transforming' | 'overdrive';
  armor: 'closed' | 'left' | 'right';
  nextSide: 'left' | 'right';
  armorSeconds: number;
  transformationSeconds: number;
  attack: 'idle' | 'drill-charge' | 'drill-burst' | 'special-charge';
  attackSeconds: number;
  cooldown: number;
  specialCooldown: number;
  armCooldown: number;
  armChargeSeconds: number;
  shotsRemaining: number;
  target: Point;
}

export function createStage2BossState(): Stage2BossState {
  return {
    form: 'normal', armor: 'closed', nextSide: 'left', armorSeconds: 1.4,
    transformationSeconds: 0, attack: 'idle', attackSeconds: 0,
    cooldown: 1.8, specialCooldown: 6.5, armCooldown: 1, armChargeSeconds: 0,
    shotsRemaining: 0, target: { x: 640, y: 620 },
  };
}

export function getStage2WeakPoint(enemy: Enemy): (Point & { radius: number }) | undefined {
  const state = enemy.stage2Boss;
  if (!state || state.form === 'transforming') return undefined;
  if (state.form === 'overdrive') return { x: enemy.x, y: enemy.y - 14, radius: 18 };
  if (state.armor === 'closed') return undefined;
  return { x: enemy.x + (state.armor === 'left' ? -20 : 24), y: enemy.y - 14, radius: 12 };
}

export function getDrillMuzzle(enemy: Enemy): Point {
  return { x: enemy.x - 105, y: enemy.y + 70 };
}

export function getArmMuzzle(enemy: Enemy): Point {
  return { x: enemy.x + 100, y: enemy.y + 45 };
}

/** Perspective growth follows travel distance, independently of the boss's movement. */
export function getDrillScale(bullet: Bullet): number {
  const progress = Math.max(0, Math.min(1, (bullet.age ?? 0) * Math.hypot(bullet.vx, bullet.vy) / 180));
  return 1 + progress * progress * (3 - 2 * progress);
}

/** Let shots reach the chest instead of being absorbed by the legs below it. */
export function stage2ShotImpact(enemy: Enemy, bullet: Bullet): 'weak-point' | 'armor' | undefined {
  const weakPoint = getStage2WeakPoint(enemy);
  if (weakPoint && Math.hypot(bullet.x - weakPoint.x, bullet.y - weakPoint.y) <= weakPoint.radius + bullet.radius) return 'weak-point';
  const chestY = enemy.y - 14;
  if (bullet.y <= chestY && bullet.y >= chestY - 30 && Math.abs(bullet.x - enemy.x) <= 96 + bullet.radius) return 'armor';
  return undefined;
}

/** A smaller cone inside the sprite, oriented along the projectile's velocity. */
export function drillHitsPlayer(bullet: Bullet, player: Point): boolean {
  const speed = Math.hypot(bullet.vx, bullet.vy);
  const ux = speed > 0 ? bullet.vx / speed : 0;
  const uy = speed > 0 ? bullet.vy / speed : 1;
  const dx = player.x - bullet.x;
  const dy = player.y - bullet.y;
  const scale = getDrillScale(bullet);
  const along = (dx * ux + dy * uy) / scale;
  const across = (dx * uy - dy * ux) / scale;
  const alongExtent = (Math.abs(ux) * 7 + Math.abs(uy) * 10) / scale;
  const acrossExtent = (Math.abs(uy) * 7 + Math.abs(ux) * 10) / scale;
  if (along < -22 - alongExtent || along > 28 + alongExtent) return false;
  const halfWidth = 12 * (28 - Math.max(-22, Math.min(28, along))) / 50;
  return Math.abs(across) < halfWidth + acrossExtent;
}

export function updateStage2Boss(enemy: Enemy, delta: number, player: Point): { bullets: Bullet[]; transformed: boolean } {
  const state = enemy.stage2Boss ??= createStage2BossState();
  const bullets: Bullet[] = [];
  // Keep the whole 260px sprite inside the field, including the drill and clamp.
  enemy.x = 640 + Math.sin(enemy.phase * 0.45) * 200;
  enemy.y = 185 + Math.sin(enemy.phase * 0.9) * 18;

  if (state.form === 'normal' && enemy.hp <= enemy.maxHp / 2) {
    state.form = 'transforming';
    state.transformationSeconds = 1.2;
    state.armor = 'closed';
    state.attack = 'idle';
    state.shotsRemaining = 0;
    state.armChargeSeconds = 0;
    return { bullets, transformed: true };
  }
  if (state.form === 'transforming') {
    state.transformationSeconds = Math.max(0, state.transformationSeconds - delta);
    if (state.transformationSeconds === 0) {
      state.form = 'overdrive';
      state.cooldown = 0.8;
      state.specialCooldown = 3.5;
      state.armCooldown = 0.8;
    }
    return { bullets, transformed: false };
  }

  if (state.form === 'normal') {
    state.armorSeconds -= delta;
    if (state.armorSeconds <= 0) {
      if (state.armor === 'closed') {
        state.armor = state.nextSide;
        state.nextSide = state.nextSide === 'left' ? 'right' : 'left';
        state.armorSeconds = 4.6;
      } else {
        state.armor = 'closed';
        state.armorSeconds = 1;
      }
    }
  }

  // Slow, scattered aimed shots restrict routes while the opposite arm fires drills.
  state.armCooldown = Math.max(0, state.armCooldown - delta);
  if (state.armChargeSeconds > 0) {
    state.armChargeSeconds = Math.max(0, state.armChargeSeconds - delta);
    if (state.armChargeSeconds === 0) {
      const muzzle = getArmMuzzle(enemy);
      const aim = Math.atan2(player.y - muzzle.y, player.x - muzzle.x);
      const angle = aim + (Math.random() * 2 - 1) * Math.PI / 6;
      bullets.push({ ...muzzle, vx: Math.cos(angle) * 95, vy: Math.sin(angle) * 95, radius: 6, fromPlayer: false, damage: 1, kind: 'suppressive' });
      state.armCooldown = state.form === 'overdrive' ? 0.7 : 0.85;
    }
  } else if (state.armCooldown === 0) {
    state.armChargeSeconds = 0.25;
  }

  state.cooldown = Math.max(0, state.cooldown - delta);
  state.specialCooldown = Math.max(0, state.specialCooldown - delta);
  if (state.attack === 'idle') {
    if (state.form === 'overdrive' && state.specialCooldown === 0) {
      state.attack = 'special-charge';
      state.attackSeconds = 1;
    } else if (state.cooldown === 0) {
      state.attack = 'drill-charge';
      state.attackSeconds = 0.7;
      // Lock the target when the warning starts, so the indicated path is avoidable.
      state.target = { ...player };
      state.shotsRemaining = state.form === 'overdrive' ? 2 : 1;
    }
    return { bullets, transformed: false };
  }

  state.attackSeconds -= delta;
  if (state.attackSeconds > 0) return { bullets, transformed: false };
  if (state.attack === 'special-charge') {
    // Keep the decorative fans distinct from the live arm fire and drill attacks.
    for (const side of [-1, 1]) {
      for (let index = 0; index < 9; index += 1) {
        const angle = side * (0.28 + index * 0.12);
        bullets.push({ x: enemy.x + side * 46, y: enemy.y - 45, vx: Math.sin(angle) * 155, vy: Math.cos(angle) * 155, radius: 5, fromPlayer: false, damage: 0, decorative: true });
      }
    }
    state.attack = 'idle';
    state.specialCooldown = 7;
    state.cooldown = 1.4;
  } else {
    const muzzle = getDrillMuzzle(enemy);
    const dx = state.target.x - muzzle.x;
    const dy = Math.max(80, state.target.y - muzzle.y);
    const length = Math.hypot(dx, dy);
    const speed = state.form === 'overdrive' ? 300 : 240;
    bullets.push({ ...muzzle, vx: speed * dx / length, vy: speed * dy / length, radius: 12, fromPlayer: false, damage: 1, kind: 'drill', age: 0 });
    state.shotsRemaining -= 1;
    if (state.shotsRemaining > 0) {
      state.attack = 'drill-burst';
      state.attackSeconds = 0.4;
    } else {
      state.attack = 'idle';
      state.cooldown = state.form === 'overdrive' ? 2.2 : 2.6;
    }
  }
  return { bullets, transformed: false };
}
