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
  baseScrollSpeed: 230,
  scrollSpeedPerMeter: 1.4,
  maxScrollSpeed: 500,
} as const;

export type HopperStatus = 'playing' | 'game-over';
export type HopperEvent = 'jump' | 'double-jump' | 'land' | 'game-over';

export interface HopperFloor {
  x: number;
  y: number;
  width: number;
}

export interface HopperSnapshot {
  playerX: number;
  playerY: number;
  grounded: boolean;
  jumpsRemaining: number;
  floors: HopperFloor[];
  distanceMeters: number;
  scrollSpeed: number;
  status: HopperStatus;
}

export class FloorHopperRun {
  playerY: number = WORLD.startFloorY;
  playerVy = 0;
  grounded = true;
  jumpsRemaining: number = WORLD.maxJumps;
  floors: HopperFloor[] = [];
  distancePixels = 0;
  status: HopperStatus = 'playing';
  private events: HopperEvent[] = [];
  private readonly rng: () => number;
  private nextFloorY: number = WORLD.startFloorY;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.floors.push({ x: 0, y: WORLD.startFloorY, width: WORLD.startFloorWidth });
    this.spawnAhead();
  }

  get distanceMeters(): number {
    return this.distancePixels / WORLD.pixelsPerMeter;
  }

  snapshot(): HopperSnapshot {
    return {
      playerX: WORLD.playerX,
      playerY: this.playerY,
      grounded: this.grounded,
      jumpsRemaining: this.jumpsRemaining,
      floors: this.floors.map((floor) => ({ ...floor })),
      distanceMeters: this.distanceMeters,
      scrollSpeed: this.scrollSpeed(),
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

  update(deltaSeconds: number): void {
    if (this.status !== 'playing') return;
    const dt = Math.min(deltaSeconds, 1 / 30);
    const speed = this.scrollSpeed();
    this.distancePixels += speed * dt;
    for (const floor of this.floors) floor.x -= speed * dt;
    this.floors = this.floors.filter((floor) => floor.x + floor.width > WORLD.cullX);
    this.spawnAhead();

    const prevY = this.playerY;
    this.playerVy += WORLD.gravity * dt;
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

    if (this.playerY > WORLD.fallLimit) {
      this.status = 'game-over';
      this.events.push('game-over');
    }
  }

  private scrollSpeed(): number {
    return Math.min(
      WORLD.maxScrollSpeed,
      WORLD.baseScrollSpeed + this.distanceMeters * WORLD.scrollSpeedPerMeter,
    );
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
    this.floors.push({ x: this.rightmost() + gap, y, width });
    this.nextFloorY = y;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
