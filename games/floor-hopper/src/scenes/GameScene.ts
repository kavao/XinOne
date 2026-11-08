import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { hideSceneLoading, playOutcomeSound, playSharedBgm, SHARED_AUDIO, showSceneLoading } from '@xinone/shared-assets';
import Phaser from 'phaser';
import {
  CLEAR_SECONDS,
  FloorHopperRun,
  scrollSpeedAt,
  skyPhaseLabel,
  skyTransitionAt,
  WORLD,
  type SkyPhase,
} from '../domain/floor-hopper';
import { FLOOR_HOPPER_AUDIO } from '../audio-manifest';
import { FLOOR_HOPPER_GAME_SCENE } from './TitleScene';
import { addHopperButton } from './ui';

const PAUSE_BUTTON_GUARD_X = 1220;

const SKY: Record<SkyPhase, { top: number; horizon: number; star: number; sun: number }> = {
  morning: { top: 0x7ec8e3, horizon: 0xffd4a3, star: 0.05, sun: 0xffe08a },
  noon: { top: 0x4aa7e0, horizon: 0xc8ecff, star: 0, sun: 0xfff4c2 },
  evening: { top: 0x2a4a7c, horizon: 0xe07a3a, star: 0.2, sun: 0xff9a4a },
  night: { top: 0x0b1a3a, horizon: 0x1a3355, star: 0.72, sun: 0xe8eefc },
  'late-night': { top: 0x050814, horizon: 0x0c1220, star: 1, sun: 0xc5d0e8 },
  dawn: { top: 0x3a2a68, horizon: 0xf0a070, star: 0.28, sun: 0xffc48a },
};

function formatLives(extraLives: number): string {
  if (extraLives <= 0) return 'LIVES  ○';
  if (extraLives <= 8) return `LIVES  ${'◆'.repeat(extraLives)}`;
  return `LIVES  ◆×${extraLives}`;
}

function lerpChannel(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t);
}

function lerpColor(from: number, to: number, t: number): number {
  const mix = Math.max(0, Math.min(1, t));
  const r = lerpChannel((from >> 16) & 0xff, (to >> 16) & 0xff, mix);
  const g = lerpChannel((from >> 8) & 0xff, (to >> 8) & 0xff, mix);
  const b = lerpChannel(from & 0xff, to & 0xff, mix);
  return (r << 16) | (g << 8) | b;
}

function hudColor(phase: SkyPhase): string {
  return phase === 'morning' || phase === 'noon' ? '#14333a' : '#f8fafc';
}

interface KickPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  kind: 'dust' | 'scuff' | 'spark' | 'ring' | 'glint';
  scroll: boolean;
}

export class FloorHopperGameScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  private run!: FloorHopperRun;
  private skyGraphics!: Phaser.GameObjects.Graphics;
  private graphics!: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Arc[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private jumpsText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private respawnText!: Phaser.GameObjects.Text;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private pointerWasDown = false;
  private resultShown = false;
  private puffs: KickPuff[] = [];
  private fallLockSeconds = 0;
  private pendingGameOver = false;

  constructor() {
    super(FLOOR_HOPPER_GAME_SCENE);
  }

  init(data: GameSceneData): void {
    this.runtime = data.runtime;
    this.run = new FloorHopperRun();
    this.pointerWasDown = false;
    this.resultShown = false;
    this.fallLockSeconds = 0;
    this.pendingGameOver = false;
    this.stars = [];
    this.puffs = [];
  }

  preload(): void {
    const jump = FLOOR_HOPPER_AUDIO.jump;
    if (!this.cache.audio.exists(jump.key)) this.load.audio(jump.key, jump.url);
    showSceneLoading(this, '#5eead4');
  }

  create(): void {
    hideSceneLoading(this);
    playSharedBgm(this, 'active');
    this.cameras.main.setBackgroundColor(0x7ec8e3);
    this.skyGraphics = this.add.graphics().setDepth(-3);
    this.createStars();
    this.graphics = this.add.graphics();
    this.scoreText = this.add.text(640, 22, '0', {
      fontFamily: 'Arial Black',
      fontSize: '34px',
      color: '#14333a',
    }).setOrigin(0.5, 0);
    this.phaseText = this.add.text(640, 58, 'MORNING', {
      fontFamily: 'Arial Black',
      fontSize: '16px',
      color: '#14333a',
    }).setOrigin(0.5, 0);
    this.detailText = this.add.text(640, 80, '0 m   ·   0 coins', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#14333a',
    }).setOrigin(0.5, 0);
    this.jumpsText = this.add.text(70, 36, '', {
      fontFamily: 'Arial Black',
      fontSize: '22px',
      color: '#14333a',
    });
    this.livesText = this.add.text(70, 68, '', {
      fontFamily: 'Arial Black',
      fontSize: '22px',
      color: '#c47b16',
    });
    this.respawnText = this.add.text(640, 160, '', {
      fontFamily: 'Arial Black',
      fontSize: '28px',
      color: '#c47b16',
    }).setOrigin(0.5, 0);
    this.input.keyboard?.addCapture('SPACE');
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.render();
  }

  update(_time: number, deltaMilliseconds: number): void {
    const deltaSeconds = deltaMilliseconds / 1000;
    if (this.fallLockSeconds > 0) {
      this.fallLockSeconds -= deltaSeconds;
      this.updatePuffs(deltaSeconds);
      this.render();
      if (this.fallLockSeconds <= 0 && this.pendingGameOver) this.showResult();
      return;
    }
    this.readJumpInput();
    this.run.update(deltaSeconds);
    this.spawnKickEffects();
    this.updatePuffs(deltaSeconds);
    this.render();
    if (this.run.status === 'cleared' && !this.resultShown) this.showResult();
  }

  private readJumpInput(): void {
    const pointer = this.input.activePointer;
    const pointerDown = pointer.leftButtonDown();
    const holdingPlayfield = pointerDown && pointer.x < PAUSE_BUTTON_GUARD_X;
    const clickedPlayfield = holdingPlayfield && !this.pointerWasDown;
    this.pointerWasDown = pointerDown;
    const spaceDown = this.spaceKey?.isDown === true;
    const pressedSpace = this.spaceKey !== undefined && Phaser.Input.Keyboard.JustDown(this.spaceKey);
    if (this.run.status === 'respawning') {
      this.run.setGlideHeld(false);
      if (pressedSpace) this.run.dropIn();
      return;
    }
    if (this.run.status !== 'playing') {
      this.run.setGlideHeld(false);
      return;
    }
    this.run.setGlideHeld(spaceDown || holdingPlayfield);
    if (clickedPlayfield || pressedSpace) this.run.jump();
  }

  private createStars(): void {
    for (let i = 0; i < 48; i += 1) {
      const star = this.add.circle(
        Phaser.Math.Between(0, WORLD.width),
        Phaser.Math.Between(0, WORLD.height * 0.62),
        Phaser.Math.FloatBetween(1, 2.2),
        0xffffff,
        0,
      ).setDepth(-2);
      star.setData('base', Phaser.Math.FloatBetween(0.25, 0.9));
      this.stars.push(star);
    }
  }

  private render(): void {
    const snapshot = this.run.snapshot();
    const transition = skyTransitionAt(snapshot.runSeconds);
    const fromSky = SKY[transition.phase];
    const toSky = SKY[transition.next];
    const top = lerpColor(fromSky.top, toSky.top, transition.t);
    const horizon = lerpColor(fromSky.horizon, toSky.horizon, transition.t);
    const starAlpha = fromSky.star + (toSky.star - fromSky.star) * transition.t;
    const sunColor = lerpColor(fromSky.sun, toSky.sun, transition.t);
    const ink = hudColor(transition.t > 0.5 ? transition.next : transition.phase);

    this.cameras.main.setBackgroundColor(top);
    this.scoreText.setColor(ink);
    this.phaseText.setColor(ink);
    this.detailText.setColor(ink);
    this.jumpsText.setColor(ink);
    this.scoreText.setText(`${snapshot.score}`);
    this.phaseText.setText(skyPhaseLabel(snapshot.skyPhase));
    this.detailText.setText(`${Math.floor(snapshot.distanceMeters)} m   ·   ${snapshot.coinCount} coins`);
    const jumpMarks = snapshot.jumpsRemaining === 2 ? '◆◆' : snapshot.jumpsRemaining === 1 ? '◆○' : '○○';
    this.jumpsText.setText(snapshot.gliding ? `JUMPS  ${jumpMarks}  GLIDE` : `JUMPS  ${jumpMarks}`);
    this.livesText.setText(`${formatLives(snapshot.extraLives)}   ${snapshot.coinCount % WORLD.coinsPerLife}/${WORLD.coinsPerLife}`);
    this.respawnText.setText(
      snapshot.status === 'respawning'
        ? `SPACE TO DROP   ${snapshot.respawnSeconds.toFixed(1)}s`
        : '',
    );

    for (const star of this.stars) {
      star.setAlpha(starAlpha * (star.getData('base') as number));
    }

    this.skyGraphics.clear();
    this.skyGraphics.fillStyle(top, 1);
    this.skyGraphics.fillRect(0, 0, WORLD.width, WORLD.height);
    this.skyGraphics.fillStyle(horizon, 1);
    this.skyGraphics.fillRect(0, 430, WORLD.width, 290);
    const body = this.celestialBody(snapshot.runSeconds);
    this.skyGraphics.fillStyle(sunColor, body.alpha);
    this.skyGraphics.fillCircle(body.x, body.y, body.radius);
    if (snapshot.skyPhase === 'night' || snapshot.skyPhase === 'late-night') {
      this.skyGraphics.fillStyle(0x0b1a3a, 0.35);
      this.skyGraphics.fillCircle(body.x - 10, body.y - 6, 16);
    }

    const graphics = this.graphics.clear();
    for (const floor of snapshot.floors) {
      graphics.fillStyle(0x1a4d52, 1);
      graphics.fillRoundedRect(floor.x, floor.y, floor.width, WORLD.floorThickness, 8);
      graphics.fillStyle(0x5eead4, 1);
      graphics.fillRect(floor.x, floor.y, floor.width, 4);
    }
    for (const coin of snapshot.coins) {
      graphics.fillStyle(0x111111, 1);
      graphics.fillCircle(coin.x, coin.y, WORLD.coinRadius + 2.5);
      graphics.fillStyle(0xffd166, 1);
      graphics.fillCircle(coin.x, coin.y, WORLD.coinRadius);
      graphics.fillStyle(0xfff3bf, 0.9);
      graphics.fillCircle(coin.x - 3, coin.y - 3, 4);
    }

    const bodyLeft = snapshot.playerX - WORLD.playerHalfWidth;
    const bodyTop = snapshot.playerY - WORLD.playerHeight;
    const waiting = snapshot.status === 'respawning';
    if (snapshot.gliding) {
      graphics.fillStyle(0xff9f43, waiting ? 0.4 : 0.95);
      graphics.fillTriangle(
        bodyLeft - 6, bodyTop + 20,
        bodyLeft + 8, bodyTop + 14,
        bodyLeft - 2, bodyTop + 44,
      );
    }
    graphics.fillStyle(0xf8fafc, waiting ? 0.45 : 1);
    graphics.fillRoundedRect(bodyLeft + 4, bodyTop + 16, WORLD.playerHalfWidth * 2 - 8, 28, 6);
    graphics.fillStyle(0x5eead4, waiting ? 0.55 : 1);
    graphics.fillCircle(snapshot.playerX, bodyTop + 12, 11);
    this.drawPuffs(graphics);
  }

  private spawnKickEffects(): void {
    const events = this.run.consumeEvents();
    const gainedLife = events.includes('extra-life');
    for (const event of events) {
      if (event === 'jump') {
        this.playJumpSound(false);
        this.spawnGroundKick();
      }
      if (event === 'double-jump') {
        this.playJumpSound(true);
        this.spawnAirKick();
      }
      if (event === 'coin' && !gainedLife) this.spawnCoinSparkle(false);
      if (event === 'extra-life') this.spawnCoinSparkle(true);
      if (event === 'downed') this.playFallSting(false);
      if (event === 'game-over') this.playFallSting(true);
    }
  }

  private spawnCoinSparkle(lifeBonus: boolean): void {
    const x = WORLD.playerX;
    const y = this.run.playerY - WORLD.playerHeight * 0.45;
    const colors = lifeBonus
      ? [0x5eead4, 0x7ef0d8, 0x65d8ff, 0xf8fafc]
      : [0xffd166, 0xfff3bf, 0xffae42];
    this.puffs.push({
      x, y, vx: 0, vy: -8,
      life: lifeBonus ? 0.34 : 0.22,
      maxLife: lifeBonus ? 0.34 : 0.22,
      size: lifeBonus ? 7 : 4,
      color: lifeBonus ? 0x5eead4 : 0xffd166,
      kind: 'ring',
      scroll: false,
    });
    const count = lifeBonus ? 14 : 8;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = (lifeBonus ? 90 : 55) + Math.random() * (lifeBonus ? 140 : 90);
      const life = (lifeBonus ? 0.28 : 0.18) + Math.random() * 0.12;
      this.puffs.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life,
        maxLife: life,
        size: (lifeBonus ? 4 : 3.2) + Math.random() * 2.2,
        color: colors[i % colors.length],
        kind: 'glint',
        scroll: false,
      });
    }
    if (lifeBonus) {
      this.livesText.setColor('#5eead4');
      this.tweens.add({
        targets: this.livesText,
        scale: 1.25,
        duration: 140,
        yoyo: true,
        onComplete: () => this.livesText.setColor('#c47b16'),
      });
    }
  }

  private playFallSting(finalLife: boolean): void {
    if (finalLife) {
      this.fallLockSeconds = 0.95;
      this.pendingGameOver = true;
    }
    this.cameras.main.shake(finalLife ? 380 : 280, finalLife ? 0.018 : 0.012);
    this.cameras.main.flash(220, 210, 30, 50);

    const wash = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0xff2a3a, 0.4).setDepth(8);
    this.tweens.add({
      targets: wash,
      alpha: 0,
      duration: 560,
      ease: 'Cubic.easeOut',
      onComplete: () => wash.destroy(),
    });

    const dropX = WORLD.playerX;
    const dropY = WORLD.height - 18;
    const ghost = this.add.container(dropX, dropY - 40).setDepth(9);
    const body = this.add.rectangle(0, 8, WORLD.playerHalfWidth * 2 - 8, 28, 0xf8fafc);
    const head = this.add.circle(0, -12, 11, 0x5eead4);
    ghost.add([body, head]);
    this.tweens.add({
      targets: ghost,
      y: WORLD.height + 50,
      scaleX: 0.4,
      scaleY: 1.8,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeIn',
      onComplete: () => ghost.destroy(),
    });

    for (let i = 0; i < 10; i += 1) {
      const dir = i < 5 ? -1 : 1;
      const life = 0.32 + Math.random() * 0.2;
      this.puffs.push({
        x: dropX + dir * (6 + Math.random() * 18),
        y: dropY,
        vx: dir * (70 + Math.random() * 140),
        vy: -80 - Math.random() * 120,
        life,
        maxLife: life,
        size: 4 + Math.random() * 6,
        color: i % 2 === 0 ? 0xff5f4d : 0x4a3b2a,
        kind: 'dust',
        scroll: false,
      });
    }

    const miss = this.add.text(640, 360, 'FALL', {
      fontFamily: 'Arial Black',
      fontSize: '76px',
      color: '#ff5f4d',
      stroke: '#071018',
      strokeThickness: 12,
    }).setOrigin(0.5).setDepth(12).setScale(0.35).setAngle(-10);
    this.tweens.add({
      targets: miss,
      scale: 1.12,
      angle: 6,
      duration: 160,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: finalLife ? 280 : 200,
      onComplete: () => {
        this.tweens.add({
          targets: miss,
          alpha: 0,
          y: 400,
          duration: 220,
          onComplete: () => miss.destroy(),
        });
      },
    });

    this.livesText.setColor('#ff5f4d');
    this.tweens.add({
      targets: this.livesText,
      scale: 1.3,
      duration: 140,
      yoyo: true,
      onComplete: () => this.livesText.setColor('#c47b16'),
    });

    if (this.cache.audio.exists(SHARED_AUDIO.uiClick.key)) {
      this.sound.play(SHARED_AUDIO.uiClick.key, { volume: 0.55, rate: 0.48 });
    }
  }

  private playJumpSound(air: boolean): void {
    const audio = FLOOR_HOPPER_AUDIO.jump;
    if (!this.cache.audio.exists(audio.key)) return;
    this.sound.play(audio.key, { volume: air ? 0.18 : audio.volume, rate: air ? 1.18 : 1 });
  }

  private spawnGroundKick(): void {
    const x = WORLD.playerX;
    const y = this.run.playerY;
    this.puffs.push({
      x, y: y + 2, vx: 0, vy: 0,
      life: 0.22, maxLife: 0.22, size: 18, color: 0x2c241c, kind: 'scuff', scroll: true,
    });
    for (let i = 0; i < 8; i += 1) {
      const dir = i < 4 ? -1 : 1;
      const life = 0.26 + Math.random() * 0.16;
      this.puffs.push({
        x: x + dir * (4 + Math.random() * 8),
        y: y - Math.random() * 4,
        vx: dir * (50 + Math.random() * 110),
        vy: -30 - Math.random() * 70,
        life,
        maxLife: life,
        size: 3.5 + Math.random() * 5,
        color: i % 2 === 0 ? 0x4a3b2a : 0x6b5a45,
        kind: 'dust',
        scroll: true,
      });
    }
  }

  private spawnAirKick(): void {
    const x = WORLD.playerX;
    const y = this.run.playerY;
    this.puffs.push({
      x, y, vx: 0, vy: 12, life: 0.28, maxLife: 0.28, size: 10, color: 0x5eead4, kind: 'ring', scroll: false,
    });
    for (let i = 0; i < 7; i += 1) {
      const angle = Math.PI * 0.2 + Math.random() * Math.PI * 0.6;
      const speed = 90 + Math.random() * 140;
      const life = 0.22 + Math.random() * 0.14;
      this.puffs.push({
        x,
        y: y - 6,
        vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1) * 0.35,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: 2.5 + Math.random() * 3,
        color: i % 2 === 0 ? 0x5eead4 : 0xf8fafc,
        kind: 'spark',
        scroll: false,
      });
    }
  }

  private updatePuffs(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 1 / 30);
    const scroll = scrollSpeedAt(this.run.runSeconds);
    for (const puff of this.puffs) {
      puff.life -= dt;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      if (puff.scroll) puff.x -= scroll * dt;
      if (puff.kind === 'dust') puff.vy += 520 * dt;
      if (puff.kind === 'spark') puff.vy += 280 * dt;
      if (puff.kind === 'glint') puff.vy += 40 * dt;
    }
    this.puffs = this.puffs.filter((puff) => puff.life > 0);
  }

  private drawPuffs(graphics: Phaser.GameObjects.Graphics): void {
    for (const puff of this.puffs) {
      const alpha = Math.max(0, puff.life / puff.maxLife);
      if (puff.kind === 'scuff') {
        graphics.fillStyle(puff.color, alpha * 0.55);
        graphics.fillEllipse(puff.x, puff.y, puff.size * (1.4 - alpha * 0.4), puff.size * 0.28);
        continue;
      }
      if (puff.kind === 'ring') {
        const radius = puff.size + (1 - alpha) * 22;
        graphics.lineStyle(5, 0x111111, alpha);
        graphics.strokeCircle(puff.x, puff.y, radius);
        graphics.lineStyle(3, puff.color, alpha);
        graphics.strokeCircle(puff.x, puff.y, radius);
        continue;
      }
      const radius = puff.size * (puff.kind === 'glint' ? 0.55 + alpha * 0.55 : 0.55 + alpha * 0.45);
      if (puff.kind === 'glint') {
        graphics.fillStyle(0x111111, alpha);
        graphics.fillCircle(puff.x, puff.y, radius + 2);
      }
      graphics.fillStyle(puff.color, puff.kind === 'dust' ? alpha * 0.85 : alpha);
      graphics.fillCircle(puff.x, puff.y, radius);
    }
  }

  private celestialBody(runSeconds: number): { x: number; y: number; radius: number; alpha: number } {
    const t = Math.max(0, Math.min(1, runSeconds / CLEAR_SECONDS));
    return {
      x: 180 + t * 920,
      y: 150 + Math.sin(t * Math.PI) * -70,
      radius: t > 0.45 && t < 0.85 ? 18 : 26,
      alpha: 1,
    };
  }

  private showResult(): void {
    this.resultShown = true;
    const snapshot = this.run.snapshot();
    const win = snapshot.status === 'cleared';
    playOutcomeSound(this, win ? 'victory' : 'defeat');
    this.runtime.recordResult({
      gameId: 'floor-hopper',
      scoreType: 'score',
      value: snapshot.score,
      unit: '点',
      winCondition: 'higher',
      outcome: win ? 'win' : 'lose',
      playedAt: new Date().toISOString(),
    });
    this.add.rectangle(640, 360, 560, win ? 310 : 280, 0x071018, 0.94).setStrokeStyle(4, win ? 0xffd166 : 0x5eead4);
    this.add.text(640, win ? 252 : 268, win ? 'CLEAR' : 'GAME OVER', {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: win ? '#ffd166' : '#5eead4',
    }).setOrigin(0.5);
    this.add.text(640, win ? 310 : 328, `${snapshot.score}`, {
      fontFamily: 'Arial Black',
      fontSize: '36px',
      color: '#ffd166',
    }).setOrigin(0.5);
    if (win) {
      this.add.text(640, 352, `+${WORLD.clearBonus} CLEAR`, {
        fontFamily: 'Arial Black',
        fontSize: '22px',
        color: '#ffd166',
      }).setOrigin(0.5);
    }
    this.add.text(640, win ? 388 : 368, `${Math.floor(snapshot.distanceMeters)} m   ·   ${snapshot.coinCount} coins`, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#c5d6e2',
    }).setOrigin(0.5);
    addHopperButton(this, 520, 450, 'Retry', () => {
      this.scene.restart({ runtime: this.runtime });
    }, 200);
    addHopperButton(this, 760, 450, 'Launcher', () => this.runtime.returnToLauncher(), 200);
  }
}
