export const FIELD = { left: 300, right: 980, top: 0, bottom: 720 } as const;
export const PLAYER = { width: 30, height: 42, speed: 0.22 } as const;
export const PLAYER_HITBOX = { width: 14, height: 20 } as const;
export const START_LIVES = 3;
export const START_BOMBS = 3;
export const BOMB_DURATION = 0.5;
export const BOMB_RADIUS = 288;

export type ShooterStatus = 'playing' | 'clear' | 'game-over';
export type EnemyKind = 'scout' | 'striker' | 'guard' | 'turret' | 'armor' | 'splitter' | 'boss';
export type PowerUpKind = 'POWER' | 'WIDE' | 'SHIELD' | 'BOMB';

export interface Point { x: number; y: number }
export interface Bullet extends Point { vx: number; vy: number; radius: number; fromPlayer: boolean; damage: number; decorative?: boolean }
export interface Enemy extends Point { kind: EnemyKind; width: number; height: number; hp: number; maxHp: number; phase: number; resourceKind?: PowerUpKind; noAttack?: boolean; lifeTimer?: number; attackCooldown?: number; attackTelegraph?: number; damageCooldown?: number; dashCooldown?: number; dashState?: 'telegraph' | 'dash' | 'returning'; dashTimer?: number; dashTargetX?: number }
export interface PowerUp extends Point { kind: PowerUpKind; vy: number }
export interface ShooterSnapshot {
  player: Point;
  bullets: Bullet[];
  enemies: Enemy[];
  lives: number;
  score: number;
  bombCount: number;
  status: ShooterStatus;
  invulnerableSeconds: number;
  bombActiveSeconds: number;
  bossWarning: boolean;
  powerUps: PowerUp[];
  powerLevel: number;
  wideLevel: number;
  shield: boolean;
}

export type ShooterEvent = 'player-hit' | 'enemy-destroyed' | 'boss-warning' | 'boss-arrived' | 'clear' | 'game-over' | 'bomb-used';

export interface DestroyedEnemy extends Point {
  kind: EnemyKind;
}

export class MechaShooterMatch {
  readonly stage: number;
  player: Point = { x: 640, y: 620 };
  bullets: Bullet[] = [];
  enemies: Enemy[] = [];
  lives = START_LIVES;
  score = 0;
  bombCount = START_BOMBS;
  bombActiveSeconds = 0;
  powerUps: PowerUp[] = [];
  powerLevel = 1;
  wideLevel = 0;
  shield = false;
  status: ShooterStatus = 'playing';
  invulnerableSeconds = 0;
  private elapsed = 0;
  private spawnTimer = 0;
  private waveIndex = 0;
  private bossAttackTimer = 4.5;
  private bossSpawned = false;
  private bossIntroSeconds = 0;
  private moveTarget: Point = { ...this.player };
  private events: ShooterEvent[] = [];
  private destroyed: DestroyedEnemy[] = [];

  constructor(stage = 1) {
    this.stage = stage;
  }

  update(deltaSeconds: number, target: Point): void {
    if (this.status !== 'playing') return;
    const delta = Math.min(deltaSeconds, 1 / 30);
    this.moveTarget.x = clamp(target.x, FIELD.left + PLAYER.width, FIELD.right - PLAYER.width);
    this.moveTarget.y = clamp(target.y, 80, FIELD.bottom - PLAYER.height);
    this.player.x = moveToward(this.player.x, this.moveTarget.x, PLAYER_HITBOX.width);
    this.player.y = moveToward(this.player.y, this.moveTarget.y, PLAYER_HITBOX.height);
    this.elapsed += delta;
    this.invulnerableSeconds = Math.max(0, this.invulnerableSeconds - delta);
    this.bombActiveSeconds = Math.max(0, this.bombActiveSeconds - delta);
    if (this.bombActiveSeconds > 0) {
      this.invulnerableSeconds = Math.max(this.invulnerableSeconds, this.bombActiveSeconds);
      this.bullets = this.bullets.filter((bullet) => bullet.fromPlayer);
    }
    this.spawnTimer -= delta;
    this.bossAttackTimer -= delta;

    if (!this.bossSpawned && this.elapsed >= 24) {
      this.bossSpawned = true;
      this.bossIntroSeconds = 2.5;
      this.events.push('boss-warning');
    }
    if (this.bossSpawned && this.bossIntroSeconds > 0) {
      this.bossIntroSeconds = Math.max(0, this.bossIntroSeconds - delta);
      if (this.bossIntroSeconds <= 0) {
        const bossHp = this.stage === 2 ? 170 : 120;
        this.enemies.push({ x: 640, y: 120, kind: 'boss', width: 150, height: 90, hp: bossHp, maxHp: bossHp, phase: 0 });
        this.events.push('boss-arrived');
      }
    } else if (!this.bossSpawned && this.spawnTimer <= 0) {
      this.spawnTimer = 1.8;
      this.spawnWave();
    }

    for (const bullet of this.bullets) { bullet.x += bullet.vx * delta; bullet.y += bullet.vy * delta; }
    for (const powerUp of this.powerUps) powerUp.y += powerUp.vy * delta;
    for (const powerUp of this.powerUps) {
      if (hit({ x: this.player.x, y: this.player.y }, { x: powerUp.x, y: powerUp.y, width: 34, height: 34 })) {
        this.collectPowerUp(powerUp.kind);
        powerUp.y = FIELD.bottom + 100;
      }
    }
    this.powerUps = this.powerUps.filter((powerUp) => powerUp.y < FIELD.bottom + 30);
    for (const enemy of this.enemies) {
      enemy.phase += delta;
      enemy.damageCooldown = Math.max(0, (enemy.damageCooldown ?? 0) - delta);
      enemy.dashCooldown = Math.max(0, (enemy.dashCooldown ?? 0) - delta);
      enemy.attackCooldown = Math.max(0, (enemy.attackCooldown ?? 0) - delta);
      enemy.attackTelegraph = Math.max(0, (enemy.attackTelegraph ?? 0) - delta);
      if (enemy.kind === 'scout') {
        // 高速推進しながら蛇行し、主人公の軌道付近へ寄ってくる偵察機。
        enemy.y += 132 * delta;
        enemy.x += Math.sin(enemy.phase * 3.2) * 115 * delta;
        enemy.x += (this.player.x - enemy.x) * Math.min(1, delta * 0.45);
        enemy.x = clamp(enemy.x, FIELD.left + enemy.width, FIELD.right - enemy.width);
        if (!enemy.noAttack && enemy.y < this.player.y && Math.random() < delta * 0.55) this.fireStraight(enemy, 180);
        if (!enemy.noAttack && enemy.y < this.player.y && Math.random() < delta * 0.35) this.fireDecorative(enemy);
        if (this.invulnerableSeconds <= 0 && hit({ x: this.player.x, y: this.player.y }, enemy)) {
          enemy.hp = 0;
          this.takeHit();
        }
      } else if (enemy.kind === 'striker') {
        enemy.y += 74 * delta;
        enemy.x += Math.sin(enemy.phase * 2) * 70 * delta;
        if (enemy.y < this.player.y && Math.random() < delta * 0.65) this.fireAimed(enemy, 190);
        if (enemy.y < this.player.y && Math.random() < delta * 0.2) this.fireDecorative(enemy);
        if (this.invulnerableSeconds <= 0 && hit({ x: this.player.x, y: this.player.y }, enemy)) {
          enemy.hp = 0;
          this.takeHit();
        }
      } else if (enemy.kind === 'guard') {
        enemy.y += 34 * delta;
        if (enemy.y < this.player.y && Math.random() < delta * 0.45) this.fireSpread(enemy, 175);
        if (enemy.y < this.player.y && Math.random() < delta * 0.15) this.fireDecorative(enemy);
      } else if (enemy.kind === 'turret') {
        enemy.y += 18 * delta;
        enemy.lifeTimer = (enemy.lifeTimer ?? 7) - delta;
        if ((enemy.lifeTimer ?? 0) <= 0) enemy.y = FIELD.bottom + 100;
        if (enemy.y < this.player.y && (enemy.attackCooldown ?? 0) <= 0 && (enemy.attackTelegraph ?? 0) <= 0) enemy.attackTelegraph = 0.28;
        if ((enemy.attackTelegraph ?? 0) > 0 && (enemy.attackTelegraph ?? 0) <= delta) {
          this.fireTurretBurst(enemy, 330);
          enemy.attackCooldown = 1.9;
        }
      } else if (enemy.kind === 'armor') {
        enemy.y += 24 * delta;
        if (enemy.y < this.player.y && Math.random() < delta * 0.35) this.fireAimed(enemy, 155);
        if (this.invulnerableSeconds <= 0 && hit({ x: this.player.x, y: this.player.y }, enemy)) {
          enemy.hp = 0;
          this.takeHit();
        }
      } else if (enemy.kind === 'splitter') {
        enemy.y += 52 * delta;
        enemy.x += Math.sin(enemy.phase * 3) * 90 * delta;
        if (enemy.y < this.player.y && Math.random() < delta * 0.5) this.fireSpread(enemy, 190);
        if (this.invulnerableSeconds <= 0 && hit({ x: this.player.x, y: this.player.y }, enemy)) {
          enemy.hp = 0;
          this.takeHit();
        }
      } else {
        if (!enemy.dashState) {
          if (this.stage === 2) {
            enemy.x = 640 + Math.sin(enemy.phase * 0.45) * 300;
            enemy.y = 135 + Math.sin(enemy.phase * 0.9) * 48;
          } else {
            enemy.x = 640 + Math.sin(enemy.phase * 0.8) * 280;
            enemy.y = 115 + Math.sin(enemy.phase * 0.55) * 30;
          }
        }
        if (enemy.hp <= enemy.maxHp / 3 && !enemy.dashState && (enemy.dashCooldown ?? 0) <= 0) {
          enemy.dashState = 'telegraph';
          enemy.dashTimer = 0.7;
          enemy.dashTargetX = this.player.x;
        }
        if (enemy.dashState === 'telegraph') {
          enemy.dashTimer = (enemy.dashTimer ?? 0) - delta;
          enemy.x = enemy.dashTargetX ?? this.player.x;
          if ((enemy.dashTimer ?? 0) <= 0) {
            enemy.dashState = 'dash';
            enemy.dashTimer = 0.9;
            enemy.x = enemy.dashTargetX ?? enemy.x;
          }
        } else if (enemy.dashState === 'dash') {
          enemy.y += 700 * delta;
          enemy.dashTimer = (enemy.dashTimer ?? 0) - delta;
          if (this.invulnerableSeconds <= 0 && hit({ x: this.player.x, y: this.player.y }, { x: enemy.x, y: enemy.y, width: PLAYER_HITBOX.width + 34, height: PLAYER_HITBOX.height + 34 })) this.takeHit();
          if ((enemy.dashTimer ?? 0) <= 0 || enemy.y > FIELD.bottom + 100) {
            enemy.dashState = 'returning';
            enemy.dashTimer = 1.2;
            enemy.y = -130;
          }
        } else if (enemy.dashState === 'returning') {
          enemy.y += 300 * delta;
          enemy.dashTimer = (enemy.dashTimer ?? 0) - delta;
          if (enemy.y >= 115 || (enemy.dashTimer ?? 0) <= 0) {
            enemy.dashState = undefined;
            enemy.y = 115;
            const normalizedX = clamp((enemy.x - 640) / 280, -1, 1);
            enemy.phase = Math.asin(normalizedX) / 0.8;
            enemy.dashCooldown = 4;
          }
        }
        if (!enemy.dashState && enemy.y < this.player.y && Math.random() < delta * 0.8) this.fireAimed(enemy, 220);
        if (!enemy.dashState && this.bossAttackTimer <= 0) {
          this.fireBossSpecial(enemy);
          this.bossAttackTimer = 5.5;
        }
      }
    }

    this.resolveCollisions();
    this.bullets = this.bullets.filter((bullet) => bullet.y > -30 && bullet.y < FIELD.bottom + 40);
    this.enemies = this.enemies.filter((enemy) => enemy.y < FIELD.bottom + 80 && enemy.hp > 0);
    if (this.bossSpawned && this.bossIntroSeconds <= 0 && !this.enemies.some((enemy) => enemy.kind === 'boss')) {
      this.status = 'clear';
      this.events.push('clear');
    }
  }

  shoot(): void {
    if (this.status !== 'playing') return;
    const angles = this.wideLevel > 0 ? [-105, -52, 0, 52, 105] : [-70, 0, 70];
    for (const vx of angles) {
      this.bullets.push({ x: this.player.x, y: this.player.y - 25, vx, vy: -520, radius: this.wideLevel > 0 ? 6 : 5, fromPlayer: true, damage: this.powerLevel });
    }
  }

  useBomb(): boolean {
    if (this.status !== 'playing' || this.bombCount <= 0 || this.bombActiveSeconds > 0) return false;
    this.bombCount -= 1;
    this.bombActiveSeconds = BOMB_DURATION;
    this.invulnerableSeconds = BOMB_DURATION;
    for (const enemy of this.enemies) {
      if (Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) <= BOMB_RADIUS) {
        if (enemy.kind === 'boss') {
          enemy.hp = Math.max(1, enemy.hp - enemy.maxHp / 4);
        } else if (enemy.hp > 0) {
          enemy.hp = 0;
          this.noteDestroyed(enemy);
        }
      }
    }
    this.bullets = this.bullets.filter((bullet) => bullet.fromPlayer);
    this.events.push('bomb-used');
    return true;
  }

  snapshot(): ShooterSnapshot {
    return { player: { ...this.player }, bullets: this.bullets.map((b) => ({ ...b })), enemies: this.enemies.map((e) => ({ ...e })), powerUps: this.powerUps.map((p) => ({ ...p })), lives: this.lives, score: this.score, bombCount: this.bombCount, status: this.status, invulnerableSeconds: this.invulnerableSeconds, bombActiveSeconds: this.bombActiveSeconds, powerLevel: this.powerLevel, wideLevel: this.wideLevel, shield: this.shield, bossWarning: this.bossSpawned };
  }

  consumeEvents(): ShooterEvent[] { return this.events.splice(0); }

  consumeDestroyed(): DestroyedEnemy[] {
    const wrecks = this.destroyed;
    this.destroyed = [];
    return wrecks;
  }

  private noteDestroyed(enemy: Enemy): void {
    this.destroyed.push({ x: enemy.x, y: enemy.y, kind: enemy.kind });
  }

  private resolveCollisions(): void {
    for (const bullet of this.bullets) {
      if (bullet.fromPlayer) {
        for (const enemy of this.enemies) {
          if (enemy.hp <= 0 || !hit(bullet, enemy)) continue;
          // 突進の予告中・突進中は攻撃を受け付けない。弾幕を途切れさせずに済むよう、弾だけ消費する。
          if (enemy.kind === 'boss' && enemy.dashState) {
            bullet.y = -100;
            break;
          }
          if (enemy.kind === 'boss' && (enemy.damageCooldown ?? 0) > 0) {
            bullet.y = -100;
            break;
          }
          enemy.hp -= bullet.damage;
          if (enemy.kind === 'boss') {
            enemy.damageCooldown = 0.06;
          }
          bullet.y = -100;
          if (enemy.hp <= 0) {
            if (enemy.resourceKind) this.powerUps.push({ x: enemy.x, y: enemy.y, kind: enemy.resourceKind, vy: 55 });
            if (enemy.kind === 'splitter') {
              for (const offset of [-18, 18]) this.enemies.push({ x: enemy.x + offset, y: enemy.y, kind: 'scout', width: 24, height: 22, hp: 1, maxHp: 1, phase: Math.random() * Math.PI * 2, noAttack: true });
            }
            this.score += scoreForEnemy(enemy.kind);
            this.events.push('enemy-destroyed');
            this.noteDestroyed(enemy);
          }
          break;
        }
      } else if (!bullet.decorative && this.invulnerableSeconds <= 0 && hit(bullet, { x: this.player.x, y: this.player.y, width: PLAYER_HITBOX.width, height: PLAYER_HITBOX.height })) {
        bullet.y = FIELD.bottom + 100;
        this.takeHit();
      }
    }
  }

  private takeHit(): void {
    if (this.shield) {
      this.shield = false;
      this.invulnerableSeconds = 1.2;
      return;
    }
    this.lives -= 1;
    this.invulnerableSeconds = 2;
    this.events.push('player-hit');
    if (this.lives <= 0) {
      this.status = 'game-over';
      this.events.push('game-over');
    }
  }

  private spawnWave(): void {
    const center = (FIELD.left + FIELD.right) / 2;
    const stage1Patterns: Array<Array<{ kind: EnemyKind; offset: number; y: number }>> = [
      [0, 1, 2].map((index) => ({ kind: 'scout', offset: (index - 1) * 80, y: 40 })),
      [-1, 0, 1].map((index) => ({ kind: 'striker', offset: index * 100, y: 30 + Math.abs(index) * 20 })),
      [{ kind: 'striker', offset: -300, y: 40 }, { kind: 'striker', offset: 300, y: 40 }],
      [{ kind: 'guard', offset: 0, y: 30 }, { kind: 'scout', offset: -120, y: 20 }, { kind: 'scout', offset: 120, y: 20 }],
    ];
    const stage2Patterns: Array<Array<{ kind: EnemyKind; offset: number; y: number }>> = [
      [{ kind: 'armor', offset: -220, y: 35 }, { kind: 'armor', offset: 0, y: 75 }, { kind: 'armor', offset: 220, y: 35 }],
      [{ kind: 'turret', offset: -180, y: 30 }, { kind: 'turret', offset: 180, y: 30 }],
      [{ kind: 'splitter', offset: -300, y: 30 }, { kind: 'armor', offset: 0, y: 55 }, { kind: 'splitter', offset: 300, y: 30 }],
      [{ kind: 'turret', offset: -260, y: 30 }, { kind: 'turret', offset: 260, y: 30 }, { kind: 'splitter', offset: 0, y: 95 }],
      [{ kind: 'armor', offset: -250, y: 35 }, { kind: 'splitter', offset: -80, y: 75 }, { kind: 'splitter', offset: 80, y: 75 }, { kind: 'armor', offset: 250, y: 35 }],
    ];
    const patterns = this.stage === 2 ? stage2Patterns : stage1Patterns;
    const resourceSchedule: Array<{ wave: number; kind: PowerUpKind; carrier: EnemyKind }> = this.stage === 2 ? [
      { wave: 0, kind: 'WIDE', carrier: 'armor' },
      { wave: 2, kind: 'SHIELD', carrier: 'armor' },
      { wave: 4, kind: 'POWER', carrier: 'armor' },
      { wave: 5, kind: 'BOMB', carrier: 'armor' },
    ] : [
      { wave: 0, kind: 'POWER', carrier: 'scout' },
      { wave: 1, kind: 'WIDE', carrier: 'striker' },
      { wave: 3, kind: 'SHIELD', carrier: 'guard' },
      { wave: 4, kind: 'BOMB', carrier: 'scout' },
    ];
    const scheduled = resourceSchedule.find((item) => item.wave === this.waveIndex);
    for (const entry of patterns[this.waveIndex % patterns.length]) {
      const size = entry.kind === 'guard' || entry.kind === 'turret' ? { width: 58, height: 48, hp: 8 } : entry.kind === 'armor' ? { width: 70, height: 58, hp: 14 } : entry.kind === 'splitter' ? { width: 42, height: 38, hp: 4 } : { width: 32, height: 30, hp: entry.kind === 'striker' ? 3 : 2 };
      const isCarrier = scheduled && entry.kind === scheduled.carrier && !this.enemies.some((enemy) => enemy.resourceKind === scheduled.kind);
      this.enemies.push({ x: center + entry.offset, y: entry.y, kind: entry.kind, width: size.width, height: size.height, hp: size.hp, maxHp: size.hp, phase: Math.random() * Math.PI * 2, resourceKind: isCarrier ? scheduled.kind : undefined });
    }
    this.waveIndex += 1;
  }

  private collectPowerUp(kind: PowerUpKind): void {
    if (kind === 'POWER') this.powerLevel = Math.min(3, this.powerLevel + 1);
    if (kind === 'WIDE') this.wideLevel = 1;
    if (kind === 'SHIELD') this.shield = true;
    if (kind === 'BOMB') this.bombCount += 1;
  }

  private fireAimed(enemy: Enemy, speed: number): void {
    const dx = this.player.x - enemy.x;
    const dy = Math.max(1, this.player.y - enemy.y);
    const length = Math.hypot(dx, dy);
    this.bullets.push({ x: enemy.x, y: enemy.y + enemy.height / 2, vx: speed * dx / length, vy: speed * dy / length, radius: 4, fromPlayer: false, damage: 1 });
  }

  private fireSpread(enemy: Enemy, speed: number): void {
    for (const angle of [-0.22, 0.22]) {
      this.bullets.push({ x: enemy.x, y: enemy.y + enemy.height / 2, vx: speed * Math.sin(angle), vy: speed * Math.cos(angle), radius: 4, fromPlayer: false, damage: 1 });
    }
  }

  private fireTurretBurst(enemy: Enemy, speed: number): void {
    for (const angle of [-0.3, 0, 0.3]) {
      this.bullets.push({ x: enemy.x, y: enemy.y + enemy.height / 2, vx: speed * Math.sin(angle), vy: speed * Math.cos(angle), radius: 5, fromPlayer: false, damage: 1 });
    }
  }

  private fireStraight(enemy: Enemy, speed: number): void {
    this.bullets.push({ x: enemy.x, y: enemy.y + enemy.height / 2, vx: 0, vy: speed, radius: 4, fromPlayer: false, damage: 1 });
  }

  private fireDecorative(enemy: Enemy): void {
    const direction = Math.random() < 0.5 ? -1 : 1;
    this.bullets.push({ x: enemy.x, y: enemy.y + enemy.height / 2, vx: direction * (180 + Math.random() * 90), vy: 120 + Math.random() * 60, radius: 3, fromPlayer: false, damage: 0, decorative: true });
  }

  private fireBossSpecial(enemy: Enemy): void {
    for (const angle of [-0.7, -0.35, 0, 0.35, 0.7]) {
      this.bullets.push({ x: enemy.x, y: enemy.y + enemy.height / 2, vx: 150 * Math.sin(angle), vy: 175 * Math.cos(angle), radius: 5, fromPlayer: false, damage: 0, decorative: true });
    }
  }
}

function hit(point: Point, box: Point & { width: number; height: number }): boolean {
  return Math.abs(point.x - box.x) < box.width / 2 + 6 && Math.abs(point.y - box.y) < box.height / 2 + 6;
}

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function scoreForEnemy(kind: EnemyKind): number {
  if (kind === 'boss') return 5000;
  if (kind === 'armor') return 300;
  if (kind === 'turret') return 250;
  if (kind === 'splitter') return 180;
  return 100;
}
function moveToward(value: number, target: number, maxStep: number): number {
  const distance = target - value;
  return Math.abs(distance) <= maxStep ? target : value + Math.sign(distance) * maxStep;
}
