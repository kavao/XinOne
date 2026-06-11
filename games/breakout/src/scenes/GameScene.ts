import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playClickSound, playOutcomeSound, playSharedBgm, type SharedBgmTrack } from '@xinone/shared-assets';
import Phaser from 'phaser';
import {
  BALL,
  BRICK,
  BreakoutMatch,
  FIELD,
  ITEM,
  PADDLE,
  STAGE_COUNT,
  type ItemType,
} from '../domain/breakout';
import { STAGES } from '../domain/stages';
import { BREAKOUT_AUDIO } from '../audio-manifest';
import { BREAKOUT_PANEL_IMAGES } from '../image-manifest';
import { BREAKOUT_GAME_SCENE } from './TitleScene';
import { addBreakoutButton } from './ui';

interface BreakoutGameData extends GameSceneData {
  stageNumber: number;
}

const STAGE_BGM_ROTATION: SharedBgmTrack[] = ['active', 'upbeat', 'thoughtful'];

const ITEM_COLORS: Record<ItemType, number> = {
  'multi-ball': 0x65d8ff,
  'paddle-extend': 0xff70d9,
  pierce: 0xffd166,
  laser: 0xff5f4d,
};

const FINALE_ROCKET = [
  '...BB...',
  '..BBBB..',
  '.BBWWBB.',
  '.BBWWBB.',
  '.BBBBBB.',
  '.BBBBBB.',
  'BBBBBBBB',
  '.F....F.',
  '..F.RF..',
  '...RR...',
];

const FINALE_COLORS: Record<string, number> = {
  B: 0xd7c6eb,
  W: 0x65d8ff,
  F: 0xffae42,
  R: 0xff5f4d,
};

export class BreakoutGameScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  private stageNumber!: number;
  private match!: BreakoutMatch;
  private graphics!: Phaser.GameObjects.Graphics;
  private stageText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private brickParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private pointerHasMoved = false;
  private resultShown = false;

  constructor() {
    super(BREAKOUT_GAME_SCENE);
  }

  init(data: BreakoutGameData): void {
    this.runtime = data.runtime;
    this.stageNumber = data.stageNumber;
    this.match = new BreakoutMatch(STAGES[this.stageNumber - 1]);
    this.pointerHasMoved = false;
    this.resultShown = false;
  }

  preload(): void {
    for (const audio of Object.values(BREAKOUT_AUDIO)) {
      if (!this.cache.audio.exists(audio.key)) this.load.audio(audio.key, audio.url);
    }
    const panelImage = BREAKOUT_PANEL_IMAGES[this.stageNumber - 1];
    if (!this.textures.exists(panelImage.key)) this.load.image(panelImage.key, panelImage.url);
  }

  create(): void {
    const bgmTrack = STAGE_BGM_ROTATION[(this.stageNumber - 1) % STAGE_BGM_ROTATION.length];
    playSharedBgm(this, bgmTrack);
    this.cameras.main.setBackgroundColor(0x0b1024);
    this.createSidePanels();
    this.createBrickParticles();

    this.graphics = this.add.graphics();

    this.stageText = this.add.text(640, 14, '', {
      fontFamily: 'Arial Black',
      fontSize: '22px',
      color: '#ffd166',
    }).setOrigin(0.5, 0);
    this.livesText = this.add.text(960, 14, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#d7c6eb',
    }).setOrigin(1, 0);

    addBreakoutButton(this, 1180, 690, 'Launcher', () => this.runtime.returnToLauncher(), 170);

    this.input.once('pointermove', () => {
      this.pointerHasMoved = true;
    });

    this.render();
  }

  update(_time: number, deltaMilliseconds: number): void {
    if (this.match.status !== 'playing') return;

    const target = this.pointerHasMoved ? this.input.activePointer.worldX : this.match.paddleX;
    const aliveBefore = this.match.bricks.map((brick) => brick.alive);

    this.match.update(deltaMilliseconds / 1000, target);

    this.match.bricks.forEach((brick, index) => {
      if (aliveBefore[index] && !brick.alive) this.spawnBrickParticles(brick.x, brick.y, brick.kind);
    });

    let hadPaddleHit = false;
    for (const event of this.match.consumeEvents()) {
      switch (event) {
        case 'paddle-hit':
          hadPaddleHit = true;
          this.playBallHitSound();
          break;
        case 'wall-bounce':
        case 'wall-hit':
        case 'brick-break':
          this.playBallHitSound();
          break;
        case 'item-collect':
          playClickSound(this);
          break;
        case 'stage-clear':
        case 'game-clear':
        case 'game-over':
          this.showResult();
          break;
        default:
          break;
      }
    }
    if (hadPaddleHit) this.spawnRipple(this.match.paddleX, PADDLE.y);

    this.render();
  }

  private createSidePanels(): void {
    const stage = STAGES[this.stageNumber - 1];
    const panelImageKey = BREAKOUT_PANEL_IMAGES[this.stageNumber - 1].key;
    const imageSize = 280;
    const panels: Array<{ x: number; width: number; flip: boolean }> = [
      { x: 0, width: FIELD.left, flip: false },
      { x: FIELD.right, width: 1280 - FIELD.right, flip: true },
    ];
    for (const { x, width, flip } of panels) {
      this.add.rectangle(x, 0, width, 720, 0x141a33, 1).setOrigin(0, 0).setStrokeStyle(2, 0x2f3a66);
      const image = this.add.image(x + width / 2, 300, panelImageKey).setDisplaySize(imageSize, imageSize);
      image.setFlipX(flip);
      this.add.rectangle(x + width / 2, 300, imageSize, imageSize, 0x000000, 0).setStrokeStyle(2, 0xffd166, 0.5);
      this.add.text(x + width / 2, 470, stage.title, {
        fontFamily: 'Arial Black',
        fontSize: '24px',
        color: '#9fd8ff',
        align: 'center',
        wordWrap: { width: width - 40 },
      }).setOrigin(0.5);
    }
  }

  private createBrickParticles(): void {
    if (!this.textures.exists('breakout-brick-particle')) {
      const square = this.make.graphics({ x: 0, y: 0 }, false);
      square.fillStyle(0xffffff, 1);
      square.fillRect(0, 0, 8, 8);
      square.generateTexture('breakout-brick-particle', 8, 8);
      square.destroy();
    }
    this.brickParticles = this.add.particles(0, 0, 'breakout-brick-particle', {
      lifespan: 500,
      speed: { min: 80, max: 260 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      rotate: { start: 0, end: 360 },
      gravityY: 500,
      tint: [0xffd166, 0xffae42, 0xffffff],
      emitting: false,
    }).setDepth(3);
  }

  private spawnBrickParticles(x: number, y: number, kind: 'normal' | 'wall'): void {
    if (kind === 'wall') return;
    this.brickParticles.explode(14, x, y);
  }

  private playBallHitSound(): void {
    const audio = BREAKOUT_AUDIO.ballHit;
    if (this.cache.audio.exists(audio.key)) this.sound.play(audio.key, { volume: audio.volume });
  }

  private spawnRipple(x: number, y: number): void {
    const ripple = this.add.circle(x, y, BALL.radius, 0xffffff, 0);
    ripple.setStrokeStyle(2, 0x9fd8ff, 0.7);
    ripple.setDepth(2);
    this.tweens.add({
      targets: ripple,
      scale: 3,
      alpha: 0,
      duration: 350,
      ease: 'Sine.easeOut',
      onComplete: () => ripple.destroy(),
    });
  }

  private render(): void {
    const snapshot = this.match.snapshot();
    const graphics = this.graphics.clear();

    graphics.fillStyle(0x0d1230, 1);
    graphics.fillRect(FIELD.left, FIELD.top, FIELD.size, FIELD.size);
    graphics.lineStyle(4, 0xffd166, 1);
    graphics.strokeRect(FIELD.left, FIELD.top, FIELD.size, FIELD.size);

    for (const brick of snapshot.bricks) {
      if (!brick.alive) continue;
      const color = brick.kind === 'wall' ? 0x556080 : 0xffd166;
      graphics.fillStyle(color, 1);
      graphics.fillRect(brick.x - BRICK.width / 2, brick.y - BRICK.height / 2, BRICK.width, BRICK.height);
      graphics.lineStyle(2, 0x0b1024, 1);
      graphics.strokeRect(brick.x - BRICK.width / 2, brick.y - BRICK.height / 2, BRICK.width, BRICK.height);
    }

    for (const laser of snapshot.lasers) {
      graphics.fillStyle(0xff5f4d, 1);
      graphics.fillRect(laser.x - 2, laser.y - 7, 4, 14);
    }

    for (const item of snapshot.items) {
      graphics.fillStyle(ITEM_COLORS[item.type], 1);
      graphics.fillRect(item.x - ITEM.size / 2, item.y - ITEM.size / 2, ITEM.size, ITEM.size);
      graphics.lineStyle(2, 0xffffff, 0.8);
      graphics.strokeRect(item.x - ITEM.size / 2, item.y - ITEM.size / 2, ITEM.size, ITEM.size);
    }

    graphics.fillStyle(snapshot.paddleExtendRemaining > 0 ? 0xff70d9 : 0x9fd8ff, 1);
    graphics.fillRoundedRect(
      snapshot.paddle.x - snapshot.paddle.width / 2,
      PADDLE.y,
      snapshot.paddle.width,
      PADDLE.height,
      6,
    );

    for (const ball of snapshot.balls) {
      graphics.fillStyle(snapshot.pierceRemaining > 0 ? 0xffd166 : 0xffffff, 1);
      graphics.fillCircle(ball.x, ball.y, BALL.radius);
    }

    this.stageText.setText(`STAGE ${this.stageNumber}/${STAGE_COUNT} — ${this.match.stage.title}  (Bricks: ${snapshot.bricksRemaining})`);
    this.livesText.setText(`LIVES ${snapshot.lives}`);
  }

  private showResult(): void {
    if (this.resultShown) return;
    this.resultShown = true;

    if (this.match.status === 'stage-clear') {
      this.add.rectangle(640, 360, 520, 220, 0x090512, 0.94).setStrokeStyle(4, 0x65d8ff);
      this.add.text(640, 300, 'STAGE CLEAR!', {
        fontFamily: 'Arial Black',
        fontSize: '44px',
        color: '#65d8ff',
      }).setOrigin(0.5);
      addBreakoutButton(this, 640, 400, 'Next Stage', () => {
        this.scene.restart({ runtime: this.runtime, stageNumber: this.stageNumber + 1 });
      }, 240);
      return;
    }

    if (this.match.status === 'game-clear') {
      playOutcomeSound(this, 'victory');
      this.add.rectangle(640, 360, 620, 460, 0x090512, 0.94).setStrokeStyle(4, 0xffd166);
      this.add.text(640, 220, 'GAME CLEAR!', {
        fontFamily: 'Arial Black',
        fontSize: '48px',
        color: '#ffd166',
      }).setOrigin(0.5);
      this.renderFinaleArt();
      addBreakoutButton(this, 520, 580, 'Play Again', () => {
        this.scene.restart({ runtime: this.runtime, stageNumber: 1 });
      }, 220);
      addBreakoutButton(this, 760, 580, 'Launcher', () => this.runtime.returnToLauncher(), 220);
      return;
    }

    playOutcomeSound(this, 'defeat');
    this.add.rectangle(640, 360, 520, 220, 0x090512, 0.94).setStrokeStyle(4, 0xff5f4d);
    this.add.text(640, 300, 'GAME OVER', {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: '#ff5f4d',
    }).setOrigin(0.5);
    addBreakoutButton(this, 520, 400, 'Retry', () => {
      this.scene.restart({ runtime: this.runtime, stageNumber: this.stageNumber });
    }, 220);
    addBreakoutButton(this, 760, 400, 'Launcher', () => this.runtime.returnToLauncher(), 220);
  }

  private renderFinaleArt(): void {
    const cell = 18;
    const cols = FINALE_ROCKET[0].length;
    const rows = FINALE_ROCKET.length;
    const originX = 640 - (cols * cell) / 2;
    const originY = 320 - (rows * cell) / 2;
    FINALE_ROCKET.forEach((rowString, row) => {
      for (let col = 0; col < cols; col += 1) {
        const char = rowString[col];
        if (char === '.') continue;
        this.add.rectangle(
          originX + col * cell + cell / 2,
          originY + row * cell + cell / 2,
          cell - 1,
          cell - 1,
          FINALE_COLORS[char],
        );
      }
    });
  }
}
