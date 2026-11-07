import { describe, expect, it } from 'vitest';
import {
  BALL,
  BRICK,
  BreakoutMatch,
  FIELD,
  ITEM,
  PADDLE,
  STAGE_COUNT,
  type StageDefinition,
} from './breakout';

const FAR_BRICK_STAGE: StageDefinition = {
  id: 1,
  title: 'Test',
  grid: ['.........#'],
};

const SINGLE_NORMAL_BRICK_STAGE: StageDefinition = {
  id: 1,
  title: 'Test',
  grid: ['#.........'],
};

const FINAL_SINGLE_NORMAL_BRICK_STAGE: StageDefinition = {
  ...SINGLE_NORMAL_BRICK_STAGE,
  id: STAGE_COUNT,
};

const WALL_AND_NORMAL_STAGE: StageDefinition = {
  id: 1,
  title: 'Test',
  grid: ['X#........'],
};

const ALWAYS_DROP_STAGE: StageDefinition = {
  ...SINGLE_NORMAL_BRICK_STAGE,
  itemsEnabled: true,
  itemDropChance: 1,
};

const NEVER_DROP_STAGE: StageDefinition = {
  ...SINGLE_NORMAL_BRICK_STAGE,
  itemsEnabled: true,
  itemDropChance: 0,
};

describe('BreakoutMatch', () => {
  it('clamps the paddle within the field bounds', () => {
    const match = new BreakoutMatch(FAR_BRICK_STAGE);

    match.update(1 / 60, FIELD.left - 1000);
    expect(match.paddleX).toBeCloseTo(FIELD.left + match.paddleWidth / 2);

    match.update(1 / 60, FIELD.right + 1000);
    expect(match.paddleX).toBeCloseTo(FIELD.right - match.paddleWidth / 2);
  });

  it('bounces the ball off the side walls', () => {
    const match = new BreakoutMatch(FAR_BRICK_STAGE);
    match.balls[0] = { x: FIELD.left + 5, y: 400, vx: -100, vy: 0 };

    match.update(1 / 60, match.paddleX);

    expect(match.balls[0].vx).toBeGreaterThan(0);
    expect(match.balls[0].x).toBeCloseTo(FIELD.left + BALL.radius);
    expect(match.consumeEvents()).toContain('wall-bounce');
  });

  it('bounces the ball off the top wall', () => {
    const match = new BreakoutMatch(FAR_BRICK_STAGE);
    match.balls[0] = { x: 600, y: FIELD.top + 5, vx: 0, vy: -100 };

    match.update(1 / 60, match.paddleX);

    expect(match.balls[0].vy).toBeGreaterThan(0);
    expect(match.consumeEvents()).toContain('wall-bounce');
  });

  it('reflects the ball off the paddle based on the hit offset', () => {
    const match = new BreakoutMatch(FAR_BRICK_STAGE);
    const halfWidth = match.paddleWidth / 2;
    match.balls[0] = {
      x: match.paddleX + halfWidth * 0.5,
      y: PADDLE.y - BALL.radius - 1,
      vx: 0,
      vy: 200,
    };

    match.update(1 / 60, match.paddleX);

    expect(match.balls[0].vy).toBeLessThan(0);
    expect(match.balls[0].vx).toBeGreaterThan(0);
    expect(match.consumeEvents()).toContain('paddle-hit');
  });

  it('destroys a normal brick and clears the stage when it was the last one', () => {
    const match = new BreakoutMatch(SINGLE_NORMAL_BRICK_STAGE);
    const brick = match.bricks[0];
    match.balls[0] = { x: brick.x, y: brick.y, vx: 0, vy: -10 };

    match.update(1 / 60, match.paddleX);

    expect(brick.alive).toBe(false);
    const events = match.consumeEvents();
    expect(events).toContain('brick-break');
    expect(events).toContain('stage-clear');
    expect(match.status).toBe('stage-clear');
  });

  it('clears the whole game when the last stage is fully destroyed', () => {
    const match = new BreakoutMatch(FINAL_SINGLE_NORMAL_BRICK_STAGE);
    const brick = match.bricks[0];
    match.balls[0] = { x: brick.x, y: brick.y, vx: 0, vy: -10 };

    match.update(1 / 60, match.paddleX);

    expect(match.consumeEvents()).toContain('game-clear');
    expect(match.status).toBe('game-clear');
  });

  it('bounces off a wall brick without destroying it', () => {
    const match = new BreakoutMatch(WALL_AND_NORMAL_STAGE);
    const wallBrick = match.bricks.find((brick) => brick.kind === 'wall')!;
    match.balls[0] = { x: wallBrick.x, y: wallBrick.y, vx: 0, vy: -10 };

    match.update(1 / 60, match.paddleX);

    expect(wallBrick.alive).toBe(true);
    expect(match.consumeEvents()).toContain('wall-hit');
    expect(match.status).toBe('playing');
  });

  it('lets the ball pass through normal bricks while pierce is active', () => {
    const match = new BreakoutMatch(SINGLE_NORMAL_BRICK_STAGE);
    const brick = match.bricks[0];
    match.pierceRemaining = ITEM.pierceDuration;
    match.balls[0] = { x: brick.x, y: brick.y, vx: 0, vy: -200 };

    match.update(1 / 60, match.paddleX);

    expect(brick.alive).toBe(false);
    expect(match.balls[0].vy).toBeLessThan(0);
    expect(match.consumeEvents()).toContain('brick-break');
  });

  it('spawns extra balls when a multi-ball item is collected', () => {
    const match = new BreakoutMatch(FAR_BRICK_STAGE);
    match.items.push({ x: match.paddleX, y: PADDLE.y, type: 'multi-ball' });

    match.update(1 / 60, match.paddleX);

    expect(match.balls.length).toBe(3);
    expect(match.consumeEvents()).toContain('item-collect');
  });

  it('temporarily extends the paddle when a paddle-extend item is collected', () => {
    const match = new BreakoutMatch(FAR_BRICK_STAGE);
    match.items.push({ x: match.paddleX, y: PADDLE.y, type: 'paddle-extend' });

    match.update(1 / 60, match.paddleX);
    expect(match.paddleWidth).toBe(PADDLE.extendedWidth);
    expect(match.paddleExtendRemaining).toBeGreaterThan(PADDLE.extendDuration - 0.05);

    match.paddleExtendRemaining = 1 / 120;
    match.update(1 / 60, match.paddleX);
    expect(match.paddleWidth).toBe(PADDLE.width);
  });

  it('loses a life when all balls fall below the field and ends the game at zero lives', () => {
    const match = new BreakoutMatch(FAR_BRICK_STAGE);
    const startingLives = match.lives;
    match.balls = [{ x: 600, y: FIELD.bottom + 100, vx: 0, vy: 0 }];

    match.update(1 / 60, match.paddleX);

    expect(match.lives).toBe(startingLives - 1);
    expect(match.balls.length).toBe(1);
    expect(match.status).toBe('playing');
    expect(match.consumeEvents()).toContain('ball-lost');

    match.lives = 1;
    match.balls = [{ x: 600, y: FIELD.bottom + 100, vx: 0, vy: 0 }];
    match.update(1 / 60, match.paddleX);

    expect(match.lives).toBe(0);
    expect(match.status).toBe('game-over');
    expect(match.consumeEvents()).toContain('game-over');
  });

  it('drops an item using the stage-specific drop chance when destroying a brick', () => {
    const match = new BreakoutMatch(ALWAYS_DROP_STAGE);
    const brick = match.bricks[0];
    match.balls[0] = { x: brick.x, y: brick.y, vx: 0, vy: -10 };

    match.update(1 / 60, match.paddleX);

    expect(match.items.length).toBe(1);
    expect(match.consumeEvents()).toContain('item-drop');
  });

  it('does not tunnel through a brick when moving faster than the brick is thick', () => {
    const match = new BreakoutMatch(SINGLE_NORMAL_BRICK_STAGE);
    const brick = match.bricks[0];
    match.balls[0] = {
      x: brick.x,
      y: brick.y - BRICK.height / 2 - BALL.radius - 2,
      vx: 0,
      vy: 2400,
    };

    match.update(1 / 30, match.paddleX);

    expect(brick.alive).toBe(false);
    expect(match.consumeEvents()).toContain('brick-break');
  });

  it('does not tunnel through the paddle when falling faster than the paddle is thick', () => {
    const match = new BreakoutMatch(FAR_BRICK_STAGE);
    match.balls[0] = {
      x: match.paddleX,
      y: PADDLE.y - BALL.radius - 2,
      vx: 0,
      vy: 2400,
    };

    match.update(1 / 30, match.paddleX);

    expect(match.balls[0].vy).toBeLessThan(0);
    expect(match.balls[0].y).toBeLessThanOrEqual(PADDLE.y - BALL.radius);
    expect(match.consumeEvents()).toContain('paddle-hit');
  });

  it('does not drop an item when the stage drop chance is zero', () => {
    const match = new BreakoutMatch(NEVER_DROP_STAGE);
    const brick = match.bricks[0];
    match.balls[0] = { x: brick.x, y: brick.y, vx: 0, vy: -10 };

    match.update(1 / 60, match.paddleX);

    expect(match.items.length).toBe(0);
    expect(match.consumeEvents()).not.toContain('item-drop');
  });

  it('drops an item from a wall brick every 20 hits without destroying it', () => {
    const match = new BreakoutMatch(WALL_AND_NORMAL_STAGE);
    const wallBrick = match.bricks.find((brick) => brick.kind === 'wall')!;

    for (let hit = 1; hit <= ITEM.wallHitsPerItem * 2; hit += 1) {
      match.balls[0] = { x: wallBrick.x, y: wallBrick.y, vx: 0, vy: -10 };
      match.update(1 / 60, match.paddleX);
      expect(wallBrick.alive).toBe(true);
      expect(wallBrick.hits).toBe(hit);
      if (hit % ITEM.wallHitsPerItem === 0) {
        expect(match.items.length).toBe(hit / ITEM.wallHitsPerItem);
        expect(match.consumeEvents()).toContain('item-drop');
      } else {
        expect(match.items.length).toBe(Math.floor(hit / ITEM.wallHitsPerItem));
        expect(match.consumeEvents()).not.toContain('item-drop');
      }
    }
  });

  it('counts wall hits per brick so neighboring walls do not share the drop', () => {
    const match = new BreakoutMatch({
      id: 1,
      title: 'Test',
      grid: ['X#.......X'],
    });
    const leftWall = match.bricks[0];
    const rightWall = match.bricks[2];

    for (let hit = 0; hit < ITEM.wallHitsPerItem - 1; hit += 1) {
      match.balls[0] = { x: leftWall.x, y: leftWall.y, vx: 0, vy: -10 };
      match.update(1 / 60, match.paddleX);
      match.consumeEvents();
    }

    expect(leftWall.hits).toBe(ITEM.wallHitsPerItem - 1);
    expect(rightWall.hits).toBe(0);

    match.balls[0] = { x: rightWall.x, y: rightWall.y, vx: 0, vy: -10 };
    match.update(1 / 60, match.paddleX);

    expect(leftWall.hits).toBe(ITEM.wallHitsPerItem - 1);
    expect(rightWall.hits).toBe(1);
    expect(match.items.length).toBe(0);
    expect(match.consumeEvents()).not.toContain('item-drop');
  });

  it('enables slice by default and stores paddle swipe as spin', () => {
    const match = new BreakoutMatch(FAR_BRICK_STAGE);
    expect(match.sliceEnabled).toBe(true);
    match.balls[0] = {
      x: match.paddleX,
      y: PADDLE.y - BALL.radius - 1,
      vx: 0,
      vy: 200,
    };

    match.update(1 / 60, match.paddleX + 30);

    expect(match.balls[0].spin).toBeGreaterThan(0);
  });

  it('deflects the next brick bounce with stored spin and then clears it', () => {
    const match = new BreakoutMatch(WALL_AND_NORMAL_STAGE);
    const wallBrick = match.bricks.find((brick) => brick.kind === 'wall')!;
    match.balls[0] = {
      x: wallBrick.x,
      y: wallBrick.y - BRICK.height / 2 - BALL.radius - 2,
      vx: 0,
      vy: 400,
      spin: 1,
    };

    match.update(1 / 60, match.paddleX);

    expect(match.balls[0].spin).toBe(0);
    expect(match.balls[0].vx).toBeGreaterThan(200);
    expect(match.consumeEvents()).toContain('wall-hit');
  });

  it('does not apply slice when the option is disabled', () => {
    const match = new BreakoutMatch(FAR_BRICK_STAGE, { sliceEnabled: false });
    match.balls[0] = {
      x: match.paddleX,
      y: PADDLE.y - BALL.radius - 1,
      vx: 0,
      vy: 200,
    };

    match.update(1 / 60, match.paddleX + 30);

    expect(match.sliceEnabled).toBe(false);
    expect(match.balls[0].spin ?? 0).toBe(0);
  });
});
