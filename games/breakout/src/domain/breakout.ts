export const FIELD = {
  size: 640,
  left: 320,
  top: 40,
  right: 960,
  bottom: 680,
  cols: 10,
} as const;

export const BRICK = {
  width: 56,
  height: 26,
  gapX: 6,
  gapY: 8,
  offsetX: FIELD.left + 10,
  offsetY: FIELD.top + 16,
} as const;

export const PADDLE = {
  width: 110,
  height: 16,
  y: FIELD.bottom - 36,
  extendedWidth: 165,
  extendDuration: 8,
} as const;

export const BALL = {
  radius: 8,
  baseSpeed: 360,
  maxSpeed: 760,
} as const;

export const ITEM = {
  size: 18,
  fallSpeed: 160,
  dropChance: 0.18,
  pierceDuration: 6,
  laserDuration: 8,
  laserInterval: 0.4,
  laserSpeed: 520,
} as const;

export const START_LIVES = 3;
export const STAGE_COUNT = 5;

const MAX_BOUNCE_ANGLE = Math.PI / 3;
const ITEM_TYPES: ItemType[] = ['multi-ball', 'paddle-extend', 'pierce', 'laser'];

export type BrickKind = 'normal' | 'wall';

export interface Brick {
  col: number;
  row: number;
  x: number;
  y: number;
  kind: BrickKind;
  alive: boolean;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type ItemType = 'multi-ball' | 'paddle-extend' | 'pierce' | 'laser';

export interface ItemDrop {
  x: number;
  y: number;
  type: ItemType;
}

export interface LaserBolt {
  x: number;
  y: number;
}

export type BreakoutEvent =
  | 'paddle-hit'
  | 'wall-bounce'
  | 'wall-hit'
  | 'brick-break'
  | 'item-drop'
  | 'item-collect'
  | 'ball-lost'
  | 'stage-clear'
  | 'game-clear'
  | 'game-over'
  | 'laser-fire';

export type BreakoutStatus = 'playing' | 'stage-clear' | 'game-clear' | 'game-over';

export interface StageDefinition {
  id: number;
  title: string;
  grid: string[];
  itemsEnabled?: boolean;
  itemDropChance?: number;
}

export interface BreakoutSnapshot {
  paddle: { x: number; width: number };
  balls: Ball[];
  bricks: Brick[];
  items: ItemDrop[];
  lasers: LaserBolt[];
  lives: number;
  status: BreakoutStatus;
  pierceRemaining: number;
  laserRemaining: number;
  paddleExtendRemaining: number;
  bricksRemaining: number;
}

export class BreakoutMatch {
  readonly bricks: Brick[];
  balls: Ball[] = [];
  items: ItemDrop[] = [];
  lasers: LaserBolt[] = [];
  paddleX = FIELD.left + FIELD.size / 2;
  paddleWidth: number = PADDLE.width;
  lives = START_LIVES;
  status: BreakoutStatus = 'playing';
  pierceRemaining = 0;
  laserRemaining = 0;
  paddleExtendRemaining = 0;
  private laserCooldown = 0;
  private events: BreakoutEvent[] = [];

  constructor(readonly stage: StageDefinition) {
    this.bricks = buildBricks(stage);
    this.spawnBall();
  }

  update(deltaSeconds: number, paddleTargetX: number): void {
    if (this.status !== 'playing') return;
    const delta = Math.min(deltaSeconds, 1 / 30);

    this.movePaddle(paddleTargetX);
    this.updateTimers(delta);
    this.updateLasers(delta);
    this.updateItems(delta);
    for (const ball of [...this.balls]) this.updateBall(ball, delta);
    this.removeLostBalls();
    if (this.status === 'playing') this.checkStageClear();
  }

  snapshot(): BreakoutSnapshot {
    return {
      paddle: { x: this.paddleX, width: this.paddleWidth },
      balls: this.balls.map((ball) => ({ ...ball })),
      bricks: this.bricks.map((brick) => ({ ...brick })),
      items: this.items.map((item) => ({ ...item })),
      lasers: this.lasers.map((laser) => ({ ...laser })),
      lives: this.lives,
      status: this.status,
      pierceRemaining: this.pierceRemaining,
      laserRemaining: this.laserRemaining,
      paddleExtendRemaining: this.paddleExtendRemaining,
      bricksRemaining: this.bricks.filter((brick) => brick.kind === 'normal' && brick.alive).length,
    };
  }

  consumeEvents(): BreakoutEvent[] {
    return this.events.splice(0);
  }

  private movePaddle(targetX: number): void {
    const halfWidth = this.paddleWidth / 2;
    this.paddleX = clamp(targetX, FIELD.left + halfWidth, FIELD.right - halfWidth);
  }

  private updateTimers(delta: number): void {
    if (this.pierceRemaining > 0) this.pierceRemaining = Math.max(0, this.pierceRemaining - delta);
    if (this.paddleExtendRemaining > 0) {
      this.paddleExtendRemaining = Math.max(0, this.paddleExtendRemaining - delta);
      if (this.paddleExtendRemaining === 0) this.paddleWidth = PADDLE.width;
    }
    if (this.laserRemaining > 0) {
      this.laserRemaining = Math.max(0, this.laserRemaining - delta);
      if (this.laserRemaining === 0) this.laserCooldown = 0;
    }
  }

  private updateLasers(delta: number): void {
    if (this.laserRemaining > 0) {
      this.laserCooldown -= delta;
      if (this.laserCooldown <= 0) {
        this.laserCooldown += ITEM.laserInterval;
        const halfWidth = this.paddleWidth / 2;
        this.lasers.push({ x: this.paddleX - halfWidth + 6, y: PADDLE.y });
        this.lasers.push({ x: this.paddleX + halfWidth - 6, y: PADDLE.y });
        this.events.push('laser-fire');
      }
    }

    for (const laser of this.lasers) laser.y -= ITEM.laserSpeed * delta;
    this.lasers = this.lasers.filter((laser) => {
      if (laser.y < FIELD.top) return false;
      for (const brick of this.bricks) {
        if (brick.kind !== 'normal' || !brick.alive) continue;
        if (!this.brickContainsPoint(brick, laser.x, laser.y)) continue;
        brick.alive = false;
        this.events.push('brick-break');
        this.maybeDropItem(brick);
        return false;
      }
      return true;
    });
  }

  private updateItems(delta: number): void {
    for (const item of this.items) item.y += ITEM.fallSpeed * delta;
    this.items = this.items.filter((item) => {
      const withinPaddle = item.y + ITEM.size / 2 >= PADDLE.y
        && item.y - ITEM.size / 2 <= PADDLE.y + PADDLE.height
        && Math.abs(item.x - this.paddleX) <= this.paddleWidth / 2 + ITEM.size / 2;
      if (withinPaddle) {
        this.collectItem(item.type);
        return false;
      }
      return item.y - ITEM.size / 2 <= FIELD.bottom;
    });
  }

  private collectItem(type: ItemType): void {
    this.events.push('item-collect');
    switch (type) {
      case 'multi-ball': {
        const source = this.balls[0];
        if (source) this.balls.push(rotateBall(source, 0.4), rotateBall(source, -0.4));
        break;
      }
      case 'paddle-extend':
        this.paddleWidth = PADDLE.extendedWidth;
        this.paddleExtendRemaining = PADDLE.extendDuration;
        break;
      case 'pierce':
        this.pierceRemaining = ITEM.pierceDuration;
        break;
      case 'laser':
        this.laserRemaining = ITEM.laserDuration;
        this.laserCooldown = 0;
        break;
    }
  }

  private updateBall(ball: Ball, delta: number): void {
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;

    if (ball.x - BALL.radius < FIELD.left) {
      ball.x = FIELD.left + BALL.radius;
      ball.vx = Math.abs(ball.vx);
      this.events.push('wall-bounce');
    } else if (ball.x + BALL.radius > FIELD.right) {
      ball.x = FIELD.right - BALL.radius;
      ball.vx = -Math.abs(ball.vx);
      this.events.push('wall-bounce');
    }

    if (ball.y - BALL.radius < FIELD.top) {
      ball.y = FIELD.top + BALL.radius;
      ball.vy = Math.abs(ball.vy);
      this.events.push('wall-bounce');
    }

    this.collideWithPaddle(ball);
    this.collideWithBricks(ball);
  }

  private collideWithPaddle(ball: Ball): void {
    if (ball.vy <= 0) return;
    const halfWidth = this.paddleWidth / 2;
    const paddleTop = PADDLE.y;
    if (ball.y + BALL.radius < paddleTop || ball.y - BALL.radius > paddleTop + PADDLE.height) return;
    if (ball.x < this.paddleX - halfWidth - BALL.radius || ball.x > this.paddleX + halfWidth + BALL.radius) return;

    const offset = clamp((ball.x - this.paddleX) / halfWidth, -1, 1);
    const angle = offset * MAX_BOUNCE_ANGLE;
    const speed = clamp(Math.hypot(ball.vx, ball.vy) * 1.02, BALL.baseSpeed, BALL.maxSpeed);
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    ball.y = paddleTop - BALL.radius;
    this.events.push('paddle-hit');
  }

  private collideWithBricks(ball: Ball): void {
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      if (!this.circleIntersectsBrick(ball, brick)) continue;

      if (this.pierceRemaining > 0 && brick.kind === 'normal') {
        brick.alive = false;
        this.events.push('brick-break');
        this.maybeDropItem(brick);
        continue;
      }

      this.bounceOffBrick(ball, brick);
      if (brick.kind === 'normal') {
        brick.alive = false;
        this.events.push('brick-break');
        this.maybeDropItem(brick);
      } else {
        this.events.push('wall-hit');
      }
      return;
    }
  }

  private circleIntersectsBrick(ball: Ball, brick: Brick): boolean {
    const halfW = BRICK.width / 2;
    const halfH = BRICK.height / 2;
    const closestX = clamp(ball.x, brick.x - halfW, brick.x + halfW);
    const closestY = clamp(ball.y, brick.y - halfH, brick.y + halfH);
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    return dx * dx + dy * dy < BALL.radius * BALL.radius;
  }

  private bounceOffBrick(ball: Ball, brick: Brick): void {
    const halfW = BRICK.width / 2;
    const halfH = BRICK.height / 2;
    const overlapX = halfW + BALL.radius - Math.abs(ball.x - brick.x);
    const overlapY = halfH + BALL.radius - Math.abs(ball.y - brick.y);
    if (overlapX < overlapY) {
      ball.vx = -ball.vx;
      ball.x += ball.x < brick.x ? -overlapX : overlapX;
    } else {
      ball.vy = -ball.vy;
      ball.y += ball.y < brick.y ? -overlapY : overlapY;
    }
  }

  private brickContainsPoint(brick: Brick, x: number, y: number): boolean {
    return Math.abs(x - brick.x) <= BRICK.width / 2 && Math.abs(y - brick.y) <= BRICK.height / 2;
  }

  private maybeDropItem(brick: Brick): void {
    if (!this.stage.itemsEnabled) return;
    const dropChance = this.stage.itemDropChance ?? ITEM.dropChance;
    if (Math.random() > dropChance) return;
    const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
    this.items.push({ x: brick.x, y: brick.y, type });
    this.events.push('item-drop');
  }

  private removeLostBalls(): void {
    const remaining = this.balls.filter((ball) => ball.y - BALL.radius <= FIELD.bottom);
    if (remaining.length === this.balls.length) return;
    this.balls = remaining;
    if (this.balls.length > 0) return;

    this.events.push('ball-lost');
    this.lives -= 1;
    if (this.lives <= 0) {
      this.status = 'game-over';
      this.events.push('game-over');
      return;
    }

    this.items = [];
    this.lasers = [];
    this.pierceRemaining = 0;
    this.laserRemaining = 0;
    this.paddleExtendRemaining = 0;
    this.paddleWidth = PADDLE.width;
    this.spawnBall();
  }

  private checkStageClear(): void {
    const bricksRemaining = this.bricks.filter((brick) => brick.kind === 'normal' && brick.alive).length;
    if (bricksRemaining > 0) return;
    if (this.stage.id >= STAGE_COUNT) {
      this.status = 'game-clear';
      this.events.push('game-clear');
    } else {
      this.status = 'stage-clear';
      this.events.push('stage-clear');
    }
  }

  private spawnBall(): void {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    this.balls = [{
      x: this.paddleX,
      y: PADDLE.y - BALL.radius - 1,
      vx: Math.cos(angle) * BALL.baseSpeed,
      vy: Math.sin(angle) * BALL.baseSpeed,
    }];
  }
}

function buildBricks(stage: StageDefinition): Brick[] {
  const bricks: Brick[] = [];
  stage.grid.forEach((rowString, row) => {
    for (let col = 0; col < FIELD.cols; col += 1) {
      const char = rowString[col] ?? '.';
      if (char === '.') continue;
      const kind: BrickKind = char === 'X' ? 'wall' : 'normal';
      bricks.push({
        col,
        row,
        x: BRICK.offsetX + col * (BRICK.width + BRICK.gapX) + BRICK.width / 2,
        y: BRICK.offsetY + row * (BRICK.height + BRICK.gapY) + BRICK.height / 2,
        kind,
        alive: true,
      });
    }
  });
  return bricks;
}

function rotateBall(ball: Ball, angle: number): Ball {
  const speed = Math.hypot(ball.vx, ball.vy);
  const currentAngle = Math.atan2(ball.vy, ball.vx);
  const newAngle = currentAngle + angle;
  return {
    x: ball.x,
    y: ball.y,
    vx: Math.cos(newAngle) * speed,
    vy: Math.sin(newAngle) * speed,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
