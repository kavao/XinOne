export type HockeyStatus = 'playing' | 'player-won' | 'cpu-won';
export type HockeyEvent = 'puck-hit' | 'goal' | 'center-boost';

export interface Point {
  x: number;
  y: number;
}

export interface CpuDifficulty {
  id: 'easy' | 'normal' | 'hard';
  label: string;
  maxSpeed: number;
  homeBias: number;
}

export const CPU_DIFFICULTIES: CpuDifficulty[] = [
  { id: 'easy', label: 'Easy', maxSpeed: 260, homeBias: 0.58 },
  { id: 'normal', label: 'Normal', maxSpeed: 390, homeBias: 0.38 },
  { id: 'hard', label: 'Hard', maxSpeed: 540, homeBias: 0.18 },
];

export const RINK = {
  left: 90,
  right: 1190,
  top: 110,
  bottom: 650,
  centerX: 640,
  centerY: 380,
  playerStartX: 250,
  cpuStartX: 1030,
  goalHalfHeight: 120,
  paddleRadius: 43,
  puckRadius: 21,
  spotRadius: 38,
  winningScore: 5,
  basePuckSpeed: 430,
  maxPuckSpeed: 1700,
  boostDuration: 2,
} as const;

export interface HockeySnapshot {
  player: Point;
  cpu: Point;
  puck: Point;
  puckVelocity: Point;
  playerScore: number;
  cpuScore: number;
  status: HockeyStatus;
  boostFlash: number;
  boostRemaining: number;
}

export class HockeyMatch {
  readonly player: Point = { x: RINK.playerStartX, y: RINK.centerY };
  readonly cpu: Point = { x: RINK.cpuStartX, y: RINK.centerY };
  readonly puck: Point = { x: RINK.centerX, y: RINK.centerY };
  readonly puckVelocity: Point = { x: -RINK.basePuckSpeed, y: RINK.basePuckSpeed * 0.25 };
  playerScore = 0;
  cpuScore = 0;
  status: HockeyStatus = 'playing';
  boostFlash = 0;
  boostRemaining = 0;
  private spotContact = true;
  private preBoostSpeed: number = RINK.basePuckSpeed;
  private events: HockeyEvent[] = [];

  constructor(readonly difficulty: CpuDifficulty) {}

  update(deltaSeconds: number, pointer: Point): void {
    if (this.status !== 'playing') return;
    const delta = Math.min(deltaSeconds, 1 / 30);
    const previousPlayer = { ...this.player };
    this.updateBoostTimer(deltaSeconds);

    this.player.x = clamp(pointer.x, RINK.left + RINK.paddleRadius, RINK.centerX - RINK.paddleRadius);
    this.player.y = clamp(pointer.y, RINK.top + RINK.paddleRadius, RINK.bottom - RINK.paddleRadius);
    this.updateCpu(delta);

    this.puck.x += this.puckVelocity.x * delta;
    this.puck.y += this.puckVelocity.y * delta;
    this.collideWithPaddle(this.player, previousPlayer, delta);
    this.collideWithPaddle(this.cpu);
    this.collideWithWallsAndGoals();
    this.applyCenterSpotBoost();
    this.boostFlash = Math.max(0, this.boostFlash - delta);
  }

  snapshot(): HockeySnapshot {
    return {
      player: { ...this.player },
      cpu: { ...this.cpu },
      puck: { ...this.puck },
      puckVelocity: { ...this.puckVelocity },
      playerScore: this.playerScore,
      cpuScore: this.cpuScore,
      status: this.status,
      boostFlash: this.boostFlash,
      boostRemaining: this.boostRemaining,
    };
  }

  consumeEvents(): HockeyEvent[] {
    return this.events.splice(0);
  }

  restart(): void {
    this.playerScore = 0;
    this.cpuScore = 0;
    this.status = 'playing';
    this.events = [];
    this.resetPuck(1);
  }

  private updateCpu(delta: number): void {
    const homeX = RINK.cpuStartX;
    const defendX = this.puck.x > RINK.centerX
      ? Math.max(RINK.centerX + RINK.paddleRadius, this.puck.x + 45)
      : homeX;
    const defendY = this.puck.x > RINK.centerX
      ? this.puck.y
      : RINK.centerY + (this.puck.y - RINK.centerY) * this.difficulty.homeBias;
    moveToward(this.cpu, {
      x: clamp(defendX, RINK.centerX + RINK.paddleRadius, RINK.right - RINK.paddleRadius),
      y: clamp(defendY, RINK.top + RINK.paddleRadius, RINK.bottom - RINK.paddleRadius),
    }, this.difficulty.maxSpeed * delta);
  }

  private collideWithPaddle(paddle: Point, previous?: Point, delta = 1): void {
    const dx = this.puck.x - paddle.x;
    const dy = this.puck.y - paddle.y;
    const minimumDistance = RINK.paddleRadius + RINK.puckRadius;
    const distance = Math.hypot(dx, dy);
    if (distance >= minimumDistance || distance === 0) return;

    const normalX = dx / distance;
    const normalY = dy / distance;
    this.puck.x = paddle.x + normalX * minimumDistance;
    this.puck.y = paddle.y + normalY * minimumDistance;

    const speed = Math.max(RINK.basePuckSpeed, Math.hypot(this.puckVelocity.x, this.puckVelocity.y) * 1.04);
    const paddleVelocityX = previous ? (paddle.x - previous.x) / delta : 0;
    const paddleVelocityY = previous ? (paddle.y - previous.y) / delta : 0;
    const influenceX = normalX * speed + paddleVelocityX * 0.25;
    const influenceY = normalY * speed + paddleVelocityY * 0.25;
    this.setPuckSpeed(influenceX, influenceY, Math.min(RINK.maxPuckSpeed, Math.hypot(influenceX, influenceY)));
    this.events.push('puck-hit');
  }

  private collideWithWallsAndGoals(): void {
    let wallBounced = false;
    if (this.puck.x - RINK.puckRadius < RINK.left) {
      if (this.isInsideGoal()) this.scoreCpu();
      else {
        this.puck.x = RINK.left + RINK.puckRadius;
        this.puckVelocity.x = Math.abs(this.puckVelocity.x);
        wallBounced = true;
      }
    } else if (this.puck.x + RINK.puckRadius > RINK.right) {
      if (this.isInsideGoal()) this.scorePlayer();
      else {
        this.puck.x = RINK.right - RINK.puckRadius;
        this.puckVelocity.x = -Math.abs(this.puckVelocity.x);
        wallBounced = true;
      }
    }

    if (this.puck.y - RINK.puckRadius < RINK.top) {
      this.puck.y = RINK.top + RINK.puckRadius;
      this.puckVelocity.y = Math.abs(this.puckVelocity.y);
      wallBounced = true;
    } else if (this.puck.y + RINK.puckRadius > RINK.bottom) {
      this.puck.y = RINK.bottom - RINK.puckRadius;
      this.puckVelocity.y = -Math.abs(this.puckVelocity.y);
      wallBounced = true;
    }
    if (wallBounced) this.events.push('puck-hit');
  }

  private applyCenterSpotBoost(): void {
    const touching = Math.hypot(this.puck.x - RINK.centerX, this.puck.y - RINK.centerY)
      <= RINK.spotRadius + RINK.puckRadius;
    if (touching && !this.spotContact && this.boostRemaining <= 0) {
      const speed = Math.hypot(this.puckVelocity.x, this.puckVelocity.y);
      this.preBoostSpeed = speed;
      this.setPuckSpeed(this.puckVelocity.x, this.puckVelocity.y, Math.min(RINK.maxPuckSpeed, speed * 2));
      this.boostRemaining = RINK.boostDuration;
      this.boostFlash = 0.35;
      this.events.push('center-boost');
    }
    this.spotContact = touching;
  }

  private isInsideGoal(): boolean {
    return Math.abs(this.puck.y - RINK.centerY) < RINK.goalHalfHeight;
  }

  private scorePlayer(): void {
    this.playerScore += 1;
    this.events.push('goal');
    if (this.playerScore >= RINK.winningScore) this.status = 'player-won';
    else this.resetPuck(1);
  }

  private scoreCpu(): void {
    this.cpuScore += 1;
    this.events.push('goal');
    if (this.cpuScore >= RINK.winningScore) this.status = 'cpu-won';
    else this.resetPuck(-1);
  }

  private resetPuck(direction: 1 | -1): void {
    this.resetPaddles();
    this.puck.x = RINK.centerX;
    this.puck.y = RINK.centerY;
    this.puckVelocity.x = RINK.basePuckSpeed * direction;
    this.puckVelocity.y = RINK.basePuckSpeed * 0.25 * direction;
    this.boostRemaining = 0;
    this.preBoostSpeed = RINK.basePuckSpeed;
    this.spotContact = true;
  }

  private resetPaddles(): void {
    this.player.x = RINK.playerStartX;
    this.player.y = RINK.centerY;
    this.cpu.x = RINK.cpuStartX;
    this.cpu.y = RINK.centerY;
  }

  private updateBoostTimer(deltaSeconds: number): void {
    if (this.boostRemaining <= 0) return;
    if (this.boostRemaining <= deltaSeconds + 1e-9) {
      this.boostRemaining = 0;
      this.setPuckSpeed(this.puckVelocity.x, this.puckVelocity.y, this.preBoostSpeed);
    } else {
      this.boostRemaining -= deltaSeconds;
    }
  }

  private setPuckSpeed(x: number, y: number, targetSpeed: number): void {
    const length = Math.hypot(x, y) || 1;
    this.puckVelocity.x = (x / length) * targetSpeed;
    this.puckVelocity.y = (y / length) * targetSpeed;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function moveToward(current: Point, target: Point, maximumDistance: number): void {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maximumDistance || distance === 0) {
    current.x = target.x;
    current.y = target.y;
    return;
  }
  current.x += (dx / distance) * maximumDistance;
  current.y += (dy / distance) * maximumDistance;
}
