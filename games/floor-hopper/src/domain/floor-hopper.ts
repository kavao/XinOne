export const WORLD = {
  width: 1280,
  height: 720,
  playerX: 280,
  playerHalfWidth: 14,
  playerHeight: 48,
  gravity: 2100,
  jumpSpeed: 820,
  doubleJumpSpeed: 760,
  maxJumps: 2,
  floorThickness: 20,
  startFloorY: 520,
  startFloorWidth: 720,
  minFloorWidth: 150,
  maxFloorWidth: 280,
  minFloorY: 300,
  maxFloorY: 600,
  maxHeightStep: 150,
  leadDistance: 520,
  cullX: -80,
  fallLimit: 760,
  pixelsPerMeter: 40,
  maxScrollSpeed: 520,
  glideGravity: 780,
  glideFallCap: 250,
  phaseSeconds: 30,
  coinRadius: 12,
  coinPoints: 100,
  clearBonus: 5000,
  coinInset: 40,
  coinMinHeight: 52,
  extraLives: 2,
  coinsPerLife: 10,
  respawnHoldSeconds: 2.5,
  respawnHoldY: 140,
} as const;

export function jumpApexHeight(speed = WORLD.jumpSpeed): number {
  return (speed * speed) / (2 * WORLD.gravity);
}

export function coinMaxHeight(): number {
  return jumpApexHeight() * 0.85;
}

export const DAY_CYCLE = [
  { id: 'morning', slow: 190, fast: 250 },
  { id: 'noon', slow: 205, fast: 300 },
  { id: 'evening', slow: 195, fast: 275 },
  { id: 'night', slow: 360, fast: 460 },
  { id: 'late-night', slow: 340, fast: 430 },
  { id: 'dawn', slow: 400, fast: 520 },
] as const;

export type SkyPhase = (typeof DAY_CYCLE)[number]['id'];
export type HopperStatus = 'playing' | 'respawning' | 'cleared' | 'game-over';
export type HopperEvent = 'jump' | 'double-jump' | 'land' | 'glide' | 'coin' | 'extra-life' | 'downed' | 'drop-in' | 'clear' | 'game-over';

export const CLEAR_SECONDS = DAY_CYCLE.length * WORLD.phaseSeconds;
export const SKY_BLEND_SECONDS = 2.5;

export function skyPhaseAt(runSeconds: number): SkyPhase {
  const index = clamp(Math.floor(runSeconds / WORLD.phaseSeconds), 0, DAY_CYCLE.length - 1);
  return DAY_CYCLE[index].id;
}

export function scrollSpeedAt(runSeconds: number): number {
  if (runSeconds <= 0) return DAY_CYCLE[0].slow;
  if (runSeconds >= CLEAR_SECONDS) return DAY_CYCLE[DAY_CYCLE.length - 1].fast;
  const index = Math.min(Math.floor(runSeconds / WORLD.phaseSeconds), DAY_CYCLE.length - 1);
  const phase = DAY_CYCLE[index];
  const local = runSeconds - index * WORLD.phaseSeconds;
  const t = clamp(local / WORLD.phaseSeconds, 0, 1);
  const eased = t * t * (3 - 2 * t);
  return phase.slow + (phase.fast - phase.slow) * eased;
}

export function skyTransitionAt(runSeconds: number): { phase: SkyPhase; next: SkyPhase; t: number } {
  const index = clamp(Math.floor(runSeconds / WORLD.phaseSeconds), 0, DAY_CYCLE.length - 1);
  const nextIndex = Math.min(index + 1, DAY_CYCLE.length - 1);
  const local = Math.max(0, runSeconds - index * WORLD.phaseSeconds);
  const t = nextIndex === index
    ? 0
    : clamp((local - (WORLD.phaseSeconds - SKY_BLEND_SECONDS)) / SKY_BLEND_SECONDS, 0, 1);
  return { phase: DAY_CYCLE[index].id, next: DAY_CYCLE[nextIndex].id, t };
}

export function skyPhaseLabel(phase: SkyPhase): string {
  switch (phase) {
    case 'morning': return 'MORNING';
    case 'noon': return 'NOON';
    case 'evening': return 'EVENING';
    case 'night': return 'NIGHT';
    case 'late-night': return 'LATE NIGHT';
    case 'dawn': return 'DAWN';
  }
}

export interface HopperFloor {
  x: number;
  y: number;
  width: number;
}

export interface HopperCoin {
  x: number;
  y: number;
}

export interface HopperSnapshot {
  playerX: number;
  playerY: number;
  grounded: boolean;
  jumpsRemaining: number;
  gliding: boolean;
  floors: HopperFloor[];
  coins: HopperCoin[];
  coinCount: number;
  extraLives: number;
  respawnSeconds: number;
  score: number;
  distanceMeters: number;
  scrollSpeed: number;
  runSeconds: number;
  skyPhase: SkyPhase;
  status: HopperStatus;
}

export class FloorHopperRun {
  playerY: number = WORLD.startFloorY;
  playerVy = 0;
  grounded = true;
  jumpsRemaining: number = WORLD.maxJumps;
  floors: HopperFloor[] = [];
  coins: HopperCoin[] = [];
  coinCount = 0;
  extraLives: number = WORLD.extraLives;
  respawnSeconds = 0;
  distancePixels = 0;
  runSeconds = 0;
  status: HopperStatus = 'playing';
  private glideHeld = false;
  private wasGliding = false;
  private events: HopperEvent[] = [];
  private readonly rng: () => number;
  private nextFloorY: number = WORLD.startFloorY;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    const startFloor = { x: 0, y: WORLD.startFloorY, width: WORLD.startFloorWidth };
    this.floors.push(startFloor);
    this.placeCoinsOnFloor(startFloor, WORLD.playerX + WORLD.coinInset);
    this.spawnAhead();
  }

  get distanceMeters(): number {
    return this.distancePixels / WORLD.pixelsPerMeter;
  }

  get score(): number {
    const runScore = Math.floor(this.distanceMeters) + this.coinCount * WORLD.coinPoints;
    return this.status === 'cleared' ? runScore + WORLD.clearBonus : runScore;
  }

  snapshot(): HopperSnapshot {
    return {
      playerX: WORLD.playerX,
      playerY: this.playerY,
      grounded: this.grounded,
      jumpsRemaining: this.jumpsRemaining,
      gliding: this.isGliding(),
      floors: this.floors.map((floor) => ({ ...floor })),
      coins: this.coins.map((coin) => ({ ...coin })),
      coinCount: this.coinCount,
      extraLives: this.extraLives,
      respawnSeconds: this.respawnSeconds,
      score: this.score,
      distanceMeters: this.distanceMeters,
      scrollSpeed: this.scrollSpeed(),
      runSeconds: this.runSeconds,
      skyPhase: skyPhaseAt(this.runSeconds),
      status: this.status,
    };
  }

  consumeEvents(): HopperEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  jump(): boolean {
    if (this.status !== 'playing' || this.jumpsRemaining <= 0) return false;
    const fromAir = !this.grounded;
    this.playerVy = -(fromAir ? WORLD.doubleJumpSpeed : WORLD.jumpSpeed);
    this.jumpsRemaining -= 1;
    this.grounded = false;
    this.events.push(fromAir ? 'double-jump' : 'jump');
    return true;
  }

  setGlideHeld(held: boolean): void {
    this.glideHeld = held;
  }

  dropIn(): boolean {
    if (this.status !== 'respawning') return false;
    this.status = 'playing';
    this.playerY = WORLD.respawnHoldY;
    this.playerVy = 120;
    this.grounded = false;
    this.jumpsRemaining = WORLD.maxJumps;
    this.respawnSeconds = 0;
    this.events.push('drop-in');
    return true;
  }

  update(deltaSeconds: number): void {
    if (this.status === 'game-over' || this.status === 'cleared') return;
    const dt = Math.min(deltaSeconds, 1 / 30);
    this.runSeconds += dt;
    this.scrollWorld(dt);
    if (this.status === 'respawning') {
      this.playerY = WORLD.respawnHoldY;
      this.playerVy = 0;
      this.respawnSeconds = Math.max(0, this.respawnSeconds - dt);
      if (this.respawnSeconds <= 0) this.dropIn();
      this.tryClear();
      return;
    }

    this.collectCoins();

    const prevY = this.playerY;
    const gliding = this.isGliding();
    if (gliding && !this.wasGliding) this.events.push('glide');
    this.wasGliding = gliding;
    const gravity = gliding ? WORLD.glideGravity : WORLD.gravity;
    this.playerVy += gravity * dt;
    if (gliding && this.playerVy > WORLD.glideFallCap) this.playerVy = WORLD.glideFallCap;
    this.playerY += this.playerVy * dt;

    const wasGrounded = this.grounded;
    this.grounded = false;
    if (this.playerVy >= 0) {
      for (const floor of this.floors) {
        if (!this.overlapsFloor(floor)) continue;
        if (prevY <= floor.y + 2 && this.playerY >= floor.y) {
          this.playerY = floor.y;
          this.playerVy = 0;
          this.grounded = true;
          this.jumpsRemaining = WORLD.maxJumps;
          if (!wasGrounded) this.events.push('land');
          break;
        }
      }
    }

    if (!this.grounded && wasGrounded) {
      this.jumpsRemaining = Math.min(this.jumpsRemaining, 1);
    }

    if (this.playerY > WORLD.fallLimit) this.handleDown();
    this.tryClear();
  }

  private tryClear(): void {
    if (this.status === 'game-over' || this.status === 'cleared') return;
    if (this.runSeconds < CLEAR_SECONDS) return;
    this.status = 'cleared';
    this.glideHeld = false;
    this.events.push('clear');
  }

  private isGliding(): boolean {
    return this.status === 'playing' && this.glideHeld && !this.grounded && this.jumpsRemaining <= 0;
  }

  private handleDown(): void {
    if (this.extraLives > 0) {
      this.extraLives -= 1;
      this.status = 'respawning';
      this.respawnSeconds = WORLD.respawnHoldSeconds;
      this.playerY = WORLD.respawnHoldY;
      this.playerVy = 0;
      this.grounded = false;
      this.jumpsRemaining = WORLD.maxJumps;
      this.events.push('downed');
      return;
    }
    this.status = 'game-over';
    this.events.push('game-over');
  }

  private scrollWorld(dt: number): void {
    const speed = this.scrollSpeed();
    this.distancePixels += speed * dt;
    for (const floor of this.floors) floor.x -= speed * dt;
    for (const coin of this.coins) coin.x -= speed * dt;
    this.floors = this.floors.filter((floor) => floor.x + floor.width > WORLD.cullX);
    this.coins = this.coins.filter((coin) => coin.x + WORLD.coinRadius > WORLD.cullX);
    this.spawnAhead();
  }

  private scrollSpeed(): number {
    return Math.min(WORLD.maxScrollSpeed, scrollSpeedAt(this.runSeconds));
  }

  private overlapsFloor(floor: HopperFloor): boolean {
    const left = WORLD.playerX - WORLD.playerHalfWidth;
    const right = WORLD.playerX + WORLD.playerHalfWidth;
    return right > floor.x && left < floor.x + floor.width;
  }

  private rightmost(): number {
    return this.floors.reduce((max, floor) => Math.max(max, floor.x + floor.width), 0);
  }

  private spawnAhead(): void {
    while (this.rightmost() < WORLD.width + WORLD.leadDistance) {
      this.spawnNextFloor();
    }
  }

  private spawnNextFloor(): void {
    const speed = this.scrollSpeed();
    const airTime = (2 * WORLD.jumpSpeed) / WORLD.gravity;
    const minGap = 70;
    const maxGap = Math.min(240, Math.max(minGap + 20, speed * airTime * 0.72));
    const gap = minGap + this.rng() * (maxGap - minGap);
    const width = WORLD.minFloorWidth + this.rng() * (WORLD.maxFloorWidth - WORLD.minFloorWidth);
    const step = (this.rng() * 2 - 1) * WORLD.maxHeightStep;
    const y = clamp(this.nextFloorY + step, WORLD.minFloorY, WORLD.maxFloorY);
    const floor = { x: this.rightmost() + gap, y, width };
    this.floors.push(floor);
    this.placeCoinsOnFloor(floor);
    this.nextFloorY = y;
  }

  private placeCoinsOnFloor(floor: HopperFloor, minX = floor.x): void {
    const left = Math.max(floor.x + WORLD.coinInset, minX);
    const right = floor.x + floor.width - WORLD.coinInset;
    if (right - left < WORLD.coinRadius * 2) return;
    const count = right - left > 160 && this.rng() > 0.55 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const x = left + WORLD.coinRadius + this.rng() * Math.max(1, right - left - WORLD.coinRadius * 2);
      const height = WORLD.coinMinHeight + this.rng() * (coinMaxHeight() - WORLD.coinMinHeight);
      const coin = { x, y: floor.y - height };
      if (isCoinReachable(coin, [floor])) this.coins.push(coin);
    }
  }

  private collectCoins(): void {
    const remaining: HopperCoin[] = [];
    for (const coin of this.coins) {
      if (this.overlapsCoin(coin)) {
        this.coinCount += 1;
        this.events.push('coin');
        if (this.coinCount % WORLD.coinsPerLife === 0) {
          this.extraLives += 1;
          this.events.push('extra-life');
        }
      } else {
        remaining.push(coin);
      }
    }
    this.coins = remaining;
  }

  private overlapsCoin(coin: HopperCoin): boolean {
    const left = WORLD.playerX - WORLD.playerHalfWidth;
    const right = WORLD.playerX + WORLD.playerHalfWidth;
    const top = this.playerY - WORLD.playerHeight;
    const bottom = this.playerY;
    const closestX = clamp(coin.x, left, right);
    const closestY = clamp(coin.y, top, bottom);
    return Math.hypot(coin.x - closestX, coin.y - closestY) <= WORLD.coinRadius;
  }
}

export function isCoinReachable(coin: HopperCoin, floors: HopperFloor[]): boolean {
  const maxHeight = coinMaxHeight();
  return floors.some((floor) => {
    const onFloor = coin.x >= floor.x + WORLD.coinInset && coin.x <= floor.x + floor.width - WORLD.coinInset;
    const height = floor.y - coin.y;
    return onFloor && height >= WORLD.coinMinHeight && height <= maxHeight;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
